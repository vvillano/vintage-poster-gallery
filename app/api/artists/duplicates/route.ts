import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * Strip accents/diacriticals from a string using Unicode normalization.
 * "Eugène Ogé" → "Eugene Oge"
 */
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

interface ArtistRow {
  id: number;
  name: string;
  aliases: string[] | null;
  nationality: string | null;
  birth_year: number | null;
  verified: boolean | null;
  poster_count: string;
}

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
    // Fetch all artists with poster counts
    const result = await sql`
      SELECT
        a.id, a.name, a.aliases, a.nationality, a.birth_year, a.verified,
        (SELECT COUNT(*) FROM posters WHERE artist_id = a.id) AS poster_count
      FROM artists a
      ORDER BY a.name ASC
    `;

    const artists = result.rows as ArtistRow[];
    const seen = new Set<string>();
    const duplicates: Array<{
      duplicate: { id: number; name: string; nationality: string | null; birthYear: number | null; verified: boolean; posterCount: number };
      canonical: { id: number; name: string; aliases: string[]; nationality: string | null; birthYear: number | null; verified: boolean; posterCount: number };
      matchType: string;
    }> = [];

    // Method 1: Artist name matches another artist's alias (accent-insensitive)
    for (const a1 of artists) {
      const a1NameNorm = stripAccents(a1.name).toLowerCase();
      for (const a2 of artists) {
        if (a1.id === a2.id) continue;
        const aliases = a2.aliases || [];
        const aliasMatch = aliases.some(
          alias => stripAccents(alias).toLowerCase() === a1NameNorm
        );
        if (aliasMatch) {
          const key = `${a1.id}-${a2.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            duplicates.push({
              duplicate: {
                id: a1.id,
                name: a1.name,
                nationality: a1.nationality,
                birthYear: a1.birth_year,
                verified: !!a1.verified,
                posterCount: parseInt(a1.poster_count, 10),
              },
              canonical: {
                id: a2.id,
                name: a2.name,
                aliases,
                nationality: a2.nationality,
                birthYear: a2.birth_year,
                verified: !!a2.verified,
                posterCount: parseInt(a2.poster_count, 10),
              },
              matchType: 'alias',
            });
          }
        }
      }
    }

    // Method 2: Name-to-name match after stripping accents
    // Canonical must be verified, duplicate must not be
    for (const a1 of artists) {
      if (a1.verified) continue; // dupe must be unverified
      const a1NameNorm = stripAccents(a1.name).toLowerCase();
      for (const a2 of artists) {
        if (a1.id === a2.id) continue;
        if (!a2.verified) continue; // canonical must be verified
        if (a1.name.toLowerCase() === a2.name.toLowerCase()) continue; // exact match, not accent variant
        if (a1NameNorm === stripAccents(a2.name).toLowerCase()) {
          const key = `${a1.id}-${a2.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            duplicates.push({
              duplicate: {
                id: a1.id,
                name: a1.name,
                nationality: a1.nationality,
                birthYear: a1.birth_year,
                verified: !!a1.verified,
                posterCount: parseInt(a1.poster_count, 10),
              },
              canonical: {
                id: a2.id,
                name: a2.name,
                aliases: a2.aliases || [],
                nationality: a2.nationality,
                birthYear: a2.birth_year,
                verified: !!a2.verified,
                posterCount: parseInt(a2.poster_count, 10),
              },
              matchType: 'accent',
            });
          }
        }
      }
    }

    // Sort by canonical name
    duplicates.sort((a, b) => a.canonical.name.localeCompare(b.canonical.name));

    return NextResponse.json({ duplicates, count: duplicates.length });
  } catch (error) {
    console.error('Find duplicates error:', error);
    return NextResponse.json(
      { error: 'Failed to find duplicates', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
