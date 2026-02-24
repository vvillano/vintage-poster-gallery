import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/push-queue-history
 * Create tables for the Shopify push queue system:
 * - push_queue: per-field pending changes per poster (persists across sessions)
 * - push_history: audit trail + undo support for every push
 * - user_settings: auto-push preferences per user
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Push queue table
    await sql`
      CREATE TABLE IF NOT EXISTS push_queue (
        id SERIAL PRIMARY KEY,
        poster_id INTEGER NOT NULL REFERENCES posters(id) ON DELETE CASCADE,
        field_key VARCHAR(50) NOT NULL,
        queued_at TIMESTAMP DEFAULT NOW(),
        auto_eligible BOOLEAN DEFAULT FALSE,
        UNIQUE(poster_id, field_key)
      )
    `;
    results.push('Created push_queue table');

    await sql`CREATE INDEX IF NOT EXISTS idx_push_queue_poster ON push_queue(poster_id)`;
    results.push('Created push_queue indexes');

    // Push history table
    await sql`
      CREATE TABLE IF NOT EXISTS push_history (
        id SERIAL PRIMARY KEY,
        poster_id INTEGER NOT NULL REFERENCES posters(id) ON DELETE CASCADE,
        field_key VARCHAR(50) NOT NULL,
        previous_value TEXT,
        new_value TEXT,
        pushed_at TIMESTAMP DEFAULT NOW(),
        pushed_by VARCHAR(100)
      )
    `;
    results.push('Created push_history table');

    await sql`CREATE INDEX IF NOT EXISTS idx_push_history_poster ON push_history(poster_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_push_history_poster_field ON push_history(poster_id, field_key)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_push_history_pushed_at ON push_history(pushed_at DESC)`;
    results.push('Created push_history indexes');

    // User settings table
    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        auto_push_settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Created user_settings table');

    return NextResponse.json({
      success: true,
      message: 'Push queue/history migration completed successfully',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
