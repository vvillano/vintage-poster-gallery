import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/attribution-basis
 * Add attribution_basis column to track how artist was identified
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Add attribution_basis column
    // Valid values: visible_signature, printed_credit, stylistic_analysis, external_knowledge, none
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS attribution_basis TEXT
    `;
    results.push('Added attribution_basis column');

    // Create index for filtering by attribution basis
    await sql`
      CREATE INDEX IF NOT EXISTS idx_posters_attribution_basis
      ON posters (attribution_basis)
    `;
    results.push('Created index on attribution_basis');

    return NextResponse.json({
      success: true,
      message: 'Attribution basis migration completed successfully',
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
