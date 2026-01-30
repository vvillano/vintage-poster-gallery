import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * GET /api/migrate/status
 * Check which migrations have been completed by inspecting the database
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status: Record<string, { completed: boolean; details?: string }> = {};

    // Check Managed Lists migration - look for media_types table
    try {
      const mediaTypesResult = await sql`
        SELECT COUNT(*) as count FROM media_types
      `;
      status['managed-lists'] = {
        completed: true,
        details: `${mediaTypesResult.rows[0].count} media types`,
      };
    } catch {
      status['managed-lists'] = { completed: false };
    }

    // Check Artist Verification migration - look for artist_confidence_score column
    try {
      await sql`
        SELECT artist_confidence_score FROM posters LIMIT 1
      `;
      status['artist-verification'] = {
        completed: true,
        details: 'Columns added',
      };
    } catch {
      status['artist-verification'] = { completed: false };
    }

    // Check Seed Artists migration - look for artists with aliases
    try {
      const artistsResult = await sql`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN aliases IS NOT NULL AND array_length(aliases, 1) > 0 THEN 1 END) as with_aliases
        FROM artists
      `;
      const total = parseInt(artistsResult.rows[0].total);
      const withAliases = parseInt(artistsResult.rows[0].with_aliases);

      if (total > 0) {
        status['seed-artists'] = {
          completed: true,
          details: `${total} artists${withAliases > 0 ? `, ${withAliases} with aliases` : ''}`,
        };
      } else {
        status['seed-artists'] = { completed: false };
      }
    } catch {
      status['seed-artists'] = { completed: false };
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Migration status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
