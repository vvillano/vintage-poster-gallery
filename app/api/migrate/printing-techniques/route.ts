import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/printing-techniques
 * Add printing_technique_ids column to posters table
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Add printing_technique_ids column
    await sql`
      ALTER TABLE posters ADD COLUMN IF NOT EXISTS printing_technique_ids JSONB DEFAULT '[]'
    `;
    results.push('Added printing_technique_ids column to posters table');

    // Create GIN index for efficient querying
    await sql`
      CREATE INDEX IF NOT EXISTS idx_posters_printing_technique_ids ON posters USING GIN (printing_technique_ids)
    `;
    results.push('Created GIN index for printing_technique_ids');

    return NextResponse.json({
      success: true,
      message: 'Printing techniques migration completed successfully',
      results,
    });
  } catch (error) {
    console.error('Printing techniques migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
