import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

// Common accented characters mapped to their ASCII equivalents
const ACCENTS_FROM = 'àáâãäåèéêëìíîïòóôõöùúûüýÿñçšžðÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇŠŽÐ';
const ACCENTS_TO   = 'aaaaaaeeeeiiiioooooouuuuyyncszdAAAAAAEEEEIIIIOOOOOUUUUYYNCSZD';

/**
 * GET /api/artists/duplicates
 * Find potential duplicate artists using two methods:
 * 1. Artist name matches another artist's alias (accent-insensitive)
 * 2. Two artists have the same name after stripping accents (verified vs unverified)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Method 1: Artist name matches another artist's alias (accent-insensitive)
    // Method 2: Name-to-name match after stripping accents (verified canonical vs unverified dupe)
    const result = await sql`
      SELECT DISTINCT ON (dupe_id, canonical_id)
        dupe_id, dupe_name, dupe_nationality, dupe_birth_year, dupe_verified,
        canonical_id, canonical_name, canonical_aliases, canonical_nationality,
        canonical_birth_year, canonical_verified,
        dupe_poster_count, canonical_poster_count, match_type
      FROM (
        -- Method 1: Accent-insensitive alias matching
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
          (SELECT COUNT(*) FROM posters WHERE artist_id = a2.id) AS canonical_poster_count,
          'alias' AS match_type
        FROM artists a1
        JOIN artists a2 ON a1.id != a2.id
          AND EXISTS (
            SELECT 1 FROM unnest(a2.aliases) AS alias
            WHERE LOWER(translate(alias, ${ACCENTS_FROM}, ${ACCENTS_TO}))
                = LOWER(translate(a1.name, ${ACCENTS_FROM}, ${ACCENTS_TO}))
          )

        UNION

        -- Method 2: Name-to-name accent match (canonical must be verified, dupe must not be)
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
          (SELECT COUNT(*) FROM posters WHERE artist_id = a2.id) AS canonical_poster_count,
          'accent' AS match_type
        FROM artists a1
        JOIN artists a2 ON a1.id != a2.id
          AND a2.verified = true
          AND (a1.verified IS NOT TRUE)
          AND LOWER(translate(a1.name, ${ACCENTS_FROM}, ${ACCENTS_TO}))
            = LOWER(translate(a2.name, ${ACCENTS_FROM}, ${ACCENTS_TO}))
          AND LOWER(a1.name) != LOWER(a2.name)
      ) AS combined
      ORDER BY canonical_name ASC, dupe_name ASC
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
      matchType: row.match_type,
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
