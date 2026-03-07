import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * GET /api/artists/duplicates
 * Find artists whose name matches another artist's alias (potential duplicates).
 * Returns pairs of { duplicate, canonical } records.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find artists whose name appears as an alias of another artist
    const result = await sql`
      SELECT
        a1.id AS dupe_id,
        a1.name AS dupe_name,
        a1.nationality AS dupe_nationality,
        a1.birth_year AS dupe_birth_year,
        a1.verified AS dupe_verified,
        a2.id AS canonical_id,
        a2.name AS canonical_name,
        a2.aliases AS canonical_aliases,
        a2.nationality AS canonical_nationality,
        a2.birth_year AS canonical_birth_year,
        a2.verified AS canonical_verified,
        (SELECT COUNT(*) FROM posters WHERE artist_id = a1.id) AS dupe_poster_count,
        (SELECT COUNT(*) FROM posters WHERE artist_id = a2.id) AS canonical_poster_count
      FROM artists a1
      JOIN artists a2 ON a1.id != a2.id
        AND EXISTS (
          SELECT 1 FROM unnest(a2.aliases) AS alias
          WHERE LOWER(alias) = LOWER(a1.name)
        )
      ORDER BY a2.name ASC
    `;

    const duplicates = result.rows.map(row => ({
      duplicate: {
        id: row.dupe_id,
        name: row.dupe_name,
        nationality: row.dupe_nationality,
        birthYear: row.dupe_birth_year,
        verified: !!row.dupe_verified,
        posterCount: parseInt(row.dupe_poster_count, 10),
      },
      canonical: {
        id: row.canonical_id,
        name: row.canonical_name,
        aliases: row.canonical_aliases || [],
        nationality: row.canonical_nationality,
        birthYear: row.canonical_birth_year,
        verified: !!row.canonical_verified,
        posterCount: parseInt(row.canonical_poster_count, 10),
      },
    }));

    return NextResponse.json({ duplicates, count: duplicates.length });
  } catch (error) {
    console.error('Find duplicates error:', error);
    return NextResponse.json(
      { error: 'Failed to find duplicates', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
