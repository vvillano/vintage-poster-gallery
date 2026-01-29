import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/condition-columns?key=run-migration-2024
 * One-time migration to add condition columns
 * DELETE THIS FILE AFTER RUNNING
 */
export async function POST(request: NextRequest) {
  try {
    // Simple key check for one-time migration
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (key !== 'run-migration-2024') {
      return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
    }

    // Add condition columns if they don't exist
    await sql`ALTER TABLE posters ADD COLUMN IF NOT EXISTS condition TEXT`;
    await sql`ALTER TABLE posters ADD COLUMN IF NOT EXISTS condition_details TEXT`;

    return NextResponse.json({
      success: true,
      message: 'Migration completed: condition and condition_details columns added',
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
