import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * Admin endpoint to fix/delete artist records with wrong Wikipedia data
 * POST /api/admin/fix-artist
 * Body: { artistName: string, deleteRecord?: boolean } or { artistId: number, deleteRecord?: boolean }
 *
 * - Unlinks all posters from this artist
 * - If deleteRecord=true, deletes the artist record entirely
 * - Otherwise just clears the Wikipedia data
 * - Also handles matching printer records
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { artistName, artistId, deleteRecord = true } = body;

    if (!artistName && !artistId) {
      return NextResponse.json({ error: 'artistName or artistId required' }, { status: 400 });
    }

    // Find the artist
    let artist;
    if (artistId) {
      const result = await sql`SELECT * FROM artists WHERE id = ${artistId}`;
      artist = result.rows[0];
    } else {
      const result = await sql`SELECT * FROM artists WHERE LOWER(name) = LOWER(${artistName})`;
      artist = result.rows[0];
    }

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Step 1: Unlink all posters from this artist
    const unlinkResult = await sql`
      UPDATE posters SET artist_id = NULL, last_modified = NOW()
      WHERE artist_id = ${artist.id}
      RETURNING id
    `;
    const unlinkedPosterIds = unlinkResult.rows.map(r => r.id);

    // Step 2: Handle printer with same name
    const printerResult = await sql`SELECT id FROM printers WHERE LOWER(name) = LOWER(${artist.name})`;
    let printerDeleted = false;
    let printerUnlinkedPosters: number[] = [];

    if (printerResult.rows.length > 0) {
      const printerId = printerResult.rows[0].id;

      // Unlink posters from printer
      const printerUnlinkResult = await sql`
        UPDATE posters SET printer_id = NULL, last_modified = NOW()
        WHERE printer_id = ${printerId}
        RETURNING id
      `;
      printerUnlinkedPosters = printerUnlinkResult.rows.map(r => r.id);

      if (deleteRecord) {
        await sql`DELETE FROM printers WHERE id = ${printerId}`;
        printerDeleted = true;
      } else {
        await sql`
          UPDATE printers SET
            wikipedia_url = NULL, bio = NULL, image_url = NULL,
            verified = false, updated_at = NOW()
          WHERE id = ${printerId}
        `;
      }
    }

    // Step 3: Delete or clear the artist record
    if (deleteRecord) {
      await sql`DELETE FROM artists WHERE id = ${artist.id}`;
    } else {
      await sql`
        UPDATE artists SET
          wikipedia_url = NULL, bio = NULL, image_url = NULL,
          nationality = NULL, birth_year = NULL, death_year = NULL,
          verified = false, updated_at = NOW()
        WHERE id = ${artist.id}
      `;
    }

    return NextResponse.json({
      success: true,
      action: deleteRecord ? 'deleted' : 'cleared',
      artist: {
        id: artist.id,
        name: artist.name,
        unlinkedPosters: unlinkedPosterIds,
      },
      printer: printerResult.rows.length > 0 ? {
        deleted: printerDeleted,
        unlinkedPosters: printerUnlinkedPosters,
      } : null,
      message: `${deleteRecord ? 'Deleted' : 'Cleared'} artist "${artist.name}". Unlinked ${unlinkedPosterIds.length} poster(s). Re-analyze the poster to create fresh records.`,
    });
  } catch (error) {
    console.error('Error fixing artist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
