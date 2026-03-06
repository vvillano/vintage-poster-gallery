import { NextRequest, NextResponse } from 'next/server';
import {
  getSyncState,
  updateSyncState,
  decideSyncMode,
  runIncrementalSync,
  runFullSyncChunk,
  finalizeFullSync,
} from '@/lib/cron-sync';

export const dynamic = 'force-dynamic';

/**
 * GET /api/products-index/cron-sync
 *
 * Vercel Cron endpoint. Triggered every 10 minutes.
 * Decides whether to run an incremental sync, start a full sync,
 * or continue an in-progress full sync.
 *
 * Auth: Vercel sends Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const state = await getSyncState();
    if (!state) {
      return NextResponse.json(
        { error: 'sync_state table not initialized. Run the Sync State migration first.' },
        { status: 500 }
      );
    }

    await updateSyncState({
      last_cron_run_at: new Date().toISOString(),
      error_message: null,
    });

    const mode = decideSyncMode(state);
    console.log(`[cron-sync] Mode: ${mode}`);

    if (mode === 'incremental') {
      const since = state.last_incremental_at
        || state.last_full_sync_completed_at
        || new Date(0).toISOString();

      const result = await runIncrementalSync(since);

      await updateSyncState({
        last_incremental_at: result.newTimestamp,
      });

      return NextResponse.json({
        mode: 'incremental',
        synced: result.synced,
        since,
      });
    }

    if (mode === 'start_full') {
      const syncTimestamp = new Date().toISOString();
      console.log(`[cron-sync] Starting new full sync`);

      await updateSyncState({
        status: 'full_in_progress',
        full_sync_cursor: null,
        full_sync_timestamp: syncTimestamp,
        full_sync_total_synced: 0,
      });

      const result = await runFullSyncChunk(null, syncTimestamp, 0);

      if (result.done) {
        await finalizeFullSync(syncTimestamp);
        const now = new Date().toISOString();
        await updateSyncState({
          status: 'idle',
          full_sync_cursor: null,
          full_sync_timestamp: null,
          full_sync_total_synced: 0,
          last_full_sync_completed_at: now,
          last_incremental_at: now,
        });
        return NextResponse.json({ mode: 'full', status: 'completed', synced: result.totalSynced });
      }

      await updateSyncState({
        full_sync_cursor: result.cursor,
        full_sync_total_synced: result.totalSynced,
      });
      return NextResponse.json({ mode: 'full', status: 'in_progress', synced: result.totalSynced });
    }

    // continue_full
    console.log(`[cron-sync] Continuing full sync from cursor, ${state.full_sync_total_synced} synced so far`);

    const result = await runFullSyncChunk(
      state.full_sync_cursor,
      state.full_sync_timestamp!,
      state.full_sync_total_synced
    );

    if (result.done) {
      await finalizeFullSync(state.full_sync_timestamp!);
      const now = new Date().toISOString();
      await updateSyncState({
        status: 'idle',
        full_sync_cursor: null,
        full_sync_timestamp: null,
        full_sync_total_synced: 0,
        last_full_sync_completed_at: now,
        last_incremental_at: now,
      });
      return NextResponse.json({ mode: 'full', status: 'completed', synced: result.totalSynced });
    }

    await updateSyncState({
      full_sync_cursor: result.cursor,
      full_sync_total_synced: result.totalSynced,
    });
    return NextResponse.json({ mode: 'full', status: 'in_progress', synced: result.totalSynced });
  } catch (error) {
    console.error('[cron-sync] Error:', error);

    try {
      await updateSyncState({ error_message: String(error).slice(0, 500) });
    } catch { /* ignore */ }

    return NextResponse.json(
      { error: 'Cron sync failed', details: String(error) },
      { status: 500 }
    );
  }
}
