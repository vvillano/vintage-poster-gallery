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

    // Check Artist Profiles migration - look for wikipedia_url column on artists and artist_id on posters
    try {
      await sql`SELECT wikipedia_url FROM artists LIMIT 1`;
      await sql`SELECT artist_id FROM posters LIMIT 1`;

      // Count verified artists and linked posters
      const verifiedResult = await sql`
        SELECT
          (SELECT COUNT(*) FROM artists WHERE verified = true) as verified_artists,
          (SELECT COUNT(*) FROM posters WHERE artist_id IS NOT NULL) as linked_posters
      `;
      const verifiedArtists = parseInt(verifiedResult.rows[0].verified_artists || '0');
      const linkedPosters = parseInt(verifiedResult.rows[0].linked_posters || '0');

      let details = 'Columns added';
      if (verifiedArtists > 0 || linkedPosters > 0) {
        details = `${verifiedArtists} verified artists, ${linkedPosters} linked posters`;
      }

      status['artist-profiles'] = {
        completed: true,
        details,
      };
    } catch {
      status['artist-profiles'] = { completed: false };
    }

    // Check Printer & Publisher migration - look for printers and publishers tables
    try {
      const printersResult = await sql`
        SELECT COUNT(*) as count FROM printers
      `;
      const publishersResult = await sql`
        SELECT COUNT(*) as count FROM publishers
      `;
      await sql`SELECT printer_id FROM posters LIMIT 1`;

      const printersCount = parseInt(printersResult.rows[0].count || '0');
      const publishersCount = parseInt(publishersResult.rows[0].count || '0');

      // Count linked posters
      const linkedResult = await sql`
        SELECT
          (SELECT COUNT(*) FROM posters WHERE printer_id IS NOT NULL) as linked_printers,
          (SELECT COUNT(*) FROM posters WHERE publisher_id IS NOT NULL) as linked_publishers
      `;
      const linkedPrinters = parseInt(linkedResult.rows[0].linked_printers || '0');
      const linkedPublishers = parseInt(linkedResult.rows[0].linked_publishers || '0');

      let details = 'Tables created';
      const parts = [];
      if (printersCount > 0) parts.push(`${printersCount} printers`);
      if (publishersCount > 0) parts.push(`${publishersCount} publishers`);
      if (linkedPrinters > 0) parts.push(`${linkedPrinters} linked printers`);
      if (linkedPublishers > 0) parts.push(`${linkedPublishers} linked publishers`);
      if (parts.length > 0) details = parts.join(', ');

      status['printer-publisher'] = {
        completed: true,
        details,
      };
    } catch {
      status['printer-publisher'] = { completed: false };
    }

    // Check Publication & Books migration - look for books table and publication columns
    try {
      const booksResult = await sql`
        SELECT COUNT(*) as count FROM books
      `;
      await sql`SELECT publication, publication_confidence, book_id FROM posters LIMIT 1`;

      const booksCount = parseInt(booksResult.rows[0].count || '0');

      // Count linked posters
      const linkedResult = await sql`
        SELECT COUNT(*) as count FROM posters WHERE book_id IS NOT NULL
      `;
      const linkedBooks = parseInt(linkedResult.rows[0].count || '0');

      let details = 'Tables and columns created';
      const parts = [];
      if (booksCount > 0) parts.push(`${booksCount} books`);
      if (linkedBooks > 0) parts.push(`${linkedBooks} linked`);
      if (parts.length > 0) details = parts.join(', ');

      status['publication-books'] = {
        completed: true,
        details,
      };
    } catch {
      status['publication-books'] = { completed: false };
    }

    // Check Platform Consolidation migration - look for unified platforms table
    try {
      const platformsResult = await sql`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN is_acquisition_platform = true THEN 1 END) as acquisition,
               COUNT(CASE WHEN is_research_site = true THEN 1 END) as research
        FROM platforms
      `;
      const total = parseInt(platformsResult.rows[0].total || '0');
      const acquisition = parseInt(platformsResult.rows[0].acquisition || '0');
      const research = parseInt(platformsResult.rows[0].research || '0');

      if (total > 0) {
        status['platform-consolidation'] = {
          completed: true,
          details: `${total} platforms (${acquisition} acquisition, ${research} research)`,
        };
      } else {
        status['platform-consolidation'] = {
          completed: true,
          details: 'Table created (empty)',
        };
      }
    } catch {
      status['platform-consolidation'] = { completed: false };
    }

    // Check Product Value Sync migration - look for colors table and colors column on posters
    try {
      const colorsResult = await sql`SELECT COUNT(*) as count FROM colors`;
      await sql`SELECT colors FROM posters LIMIT 1`;

      const colorsCount = parseInt(colorsResult.rows[0].count || '0');

      // Count posters with colors set
      let postersWithColors = 0;
      try {
        const postersResult = await sql`
          SELECT COUNT(*) as count FROM posters
          WHERE colors IS NOT NULL AND array_length(colors, 1) > 0
        `;
        postersWithColors = parseInt(postersResult.rows[0].count || '0');
      } catch {
        // Column might not support array_length yet
      }

      status['product-value-sync'] = {
        completed: true,
        details: `${colorsCount} colors${postersWithColors > 0 ? `, ${postersWithColors} posters with colors` : ''}`,
      };
    } catch {
      status['product-value-sync'] = { completed: false };
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
