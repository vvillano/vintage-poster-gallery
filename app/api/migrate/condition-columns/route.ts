import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/condition-columns
 * One-time migration to add condition columns
 * DELETE THIS FILE AFTER RUNNING
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
