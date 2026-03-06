import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/sync-state
 * Create the sync_state table for tracking automated product index sync progress.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    await sql`
      CREATE TABLE IF NOT EXISTS sync_state (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        status VARCHAR(20) NOT NULL DEFAULT 'idle',
        full_sync_cursor TEXT,
        full_sync_timestamp TIMESTAMPTZ,
        full_sync_total_synced INTEGER DEFAULT 0,
        last_full_sync_completed_at TIMESTAMPTZ,
        last_incremental_at TIMESTAMPTZ,
        last_cron_run_at TIMESTAMPTZ,
        error_message TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    results.push('Created sync_state table');

    await sql`INSERT INTO sync_state (id) VALUES (1) ON CONFLICT DO NOTHING`;
    results.push('Seeded sync_state row');

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Sync state migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}
