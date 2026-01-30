import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/artist-verification
 * Run the artist verification fields migration
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Add artist confidence score (0-100 percentage)
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS artist_confidence_score INTEGER
    `;
    results.push('Added artist_confidence_score column');

    // Add artist signature text (exact text visible on piece)
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS artist_signature_text TEXT
    `;
    results.push('Added artist_signature_text column');

    // Add artist verification data (JSON object with verification checklist)
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS artist_verification JSONB
    `;
    results.push('Added artist_verification column');

    // Create index for filtering by confidence score
    await sql`
      CREATE INDEX IF NOT EXISTS idx_posters_artist_confidence_score
      ON posters (artist_confidence_score)
    `;
    results.push('Created index on artist_confidence_score');

    return NextResponse.json({
      success: true,
      message: 'Artist verification migration completed successfully',
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
