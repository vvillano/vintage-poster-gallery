import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getSyncStatus } from '@/lib/products-index';
import { getSyncState } from '@/lib/cron-sync';
import {
  fetchProductsPage,
  upsertProducts,
  deleteStaleRows,
  linkLocalPosters,
} from '@/lib/product-sync-helpers';

export const dynamic = 'force-dynamic';

// Max pages per chunk -- keeps each function call well under timeout
const PAGES_PER_CHUNK = 5;

/**
 * POST /api/products-index/sync
 *
 * Chunked sync: processes PAGES_PER_CHUNK pages per call.
 * Body (optional): { cursor?: string, syncTimestamp?: string, totalSynced?: number }
 * Returns: { done: false, cursor, syncTimestamp, synced, chunkSynced }
 *       or { done: true, synced, elapsed }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse continuation state from body (if resuming)
    let body: { cursor?: string; syncTimestamp?: string; totalSynced?: number } = {};
    try {
      body = await request.json();
    } catch { /* first call has no body */ }

    const isFirstChunk = !body.cursor;
    const syncTimestamp = body.syncTimestamp || new Date().toISOString();
    let totalSynced = body.totalSynced || 0;
    let cursor: string | null = body.cursor || null;
    const startTime = Date.now();

    console.log(`[sync] Chunk start: isFirst=${isFirstChunk}, cursor=${cursor ? 'yes' : 'no'}, totalSynced=${totalSynced}, pagesPerChunk=${PAGES_PER_CHUNK}`);

    // First chunk: ensure columns exist
    if (isFirstChunk) {
      const alterStart = Date.now();
      try {
        await sql`ALTER TABLE products_index ADD COLUMN IF NOT EXISTS internal_tags TEXT`;
        await sql`ALTER TABLE products_index ADD COLUMN IF NOT EXISTS sales_channels TEXT`;
        console.log(`[sync] ALTER TABLE took ${Date.now() - alterStart}ms`);
      } catch {
        console.log(`[sync] ALTER TABLE skipped (${Date.now() - alterStart}ms)`);
      }
    }

    let hasNextPage = true;
    let pagesThisChunk = 0;

    while (hasNextPage && pagesThisChunk < PAGES_PER_CHUNK) {
      pagesThisChunk++;
      console.log(`[sync] Page ${pagesThisChunk}: starting Shopify call...`);
      const shopifyStart = Date.now();

      // Retry up to 2 times for transient Shopify errors (502, 503, 429, timeout)
      let pageResult;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          pageResult = await fetchProductsPage(cursor, 50);
          break;
        } catch (err) {
          console.log(`[sync] Page ${pagesThisChunk}: attempt ${attempt + 1} failed: ${String(err).slice(0, 200)}`);
          const errStr = String(err);
          const isRetryable = errStr.includes('502') || errStr.includes('503') || errStr.includes('429') || errStr.includes('timeout');
          if (isRetryable && attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          return NextResponse.json(
            { error: 'Sync failed', details: `Shopify GraphQL error (${totalSynced} synced so far): ${String(err)}` },
            { status: 500 }
          );
        }
      }

      if (!pageResult) {
        return NextResponse.json(
          { error: 'Sync failed', details: `No data returned (${totalSynced} synced so far)` },
          { status: 500 }
        );
      }

      console.log(`[sync] Page ${pagesThisChunk}: Shopify call took ${Date.now() - shopifyStart}ms, got ${pageResult.products.length} products`);

      if (pageResult.products.length > 0) {
        try {
          const dbStart = Date.now();
          const count = await upsertProducts(pageResult.products, syncTimestamp);
          console.log(`[sync] Page ${pagesThisChunk}: DB insert took ${Date.now() - dbStart}ms for ${count} products`);
          totalSynced += count;
        } catch (err) {
          return NextResponse.json(
            { error: 'Sync failed', details: `Database insert failed (${totalSynced} synced so far, batch of ${pageResult.products.length}): ${String(err)}` },
            { status: 500 }
          );
        }
      }

      hasNextPage = pageResult.hasNextPage;
      cursor = pageResult.endCursor;
    }

    // If more pages remain, return continuation state
    if (hasNextPage && cursor) {
      return NextResponse.json({
        done: false,
        cursor,
        syncTimestamp,
        synced: totalSynced,
        chunkSynced: pagesThisChunk * 50,
      });
    }

    // Final chunk: clean up stale rows and link posters
    try {
      await deleteStaleRows(syncTimestamp);
    } catch {
      // Non-fatal
    }

    try {
      await linkLocalPosters();
    } catch (err) {
      console.error('Failed to link local posters:', err);
    }

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      done: true,
      success: true,
      synced: totalSynced,
      elapsed: `${(elapsed / 1000).toFixed(1)}s`,
    });
  } catch (error) {
    console.error('Products index sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: `Unexpected error: ${String(error)}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/products-index/sync
 * Get sync status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [status, cronState] = await Promise.all([
      getSyncStatus(),
      getSyncState().catch(() => null),
    ]);

    return NextResponse.json({
      ...status,
      cron: cronState ? {
        status: cronState.status,
        lastFullSyncAt: cronState.last_full_sync_completed_at,
        lastIncrementalAt: cronState.last_incremental_at,
        lastCronRunAt: cronState.last_cron_run_at,
        fullSyncProgress: cronState.status === 'full_in_progress' ? cronState.full_sync_total_synced : null,
        error: cronState.error_message,
      } : null,
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: String(error) },
      { status: 500 }
    );
  }
}
