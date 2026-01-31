import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * Admin endpoint to fix artist records with wrong Wikipedia data
 * POST /api/admin/fix-artist
 * Body: { artistName: string } or { artistId: number }
 *
 * This clears Wikipedia URL, bio, and other data that may be from wrong person
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { artistName, artistId } = body;

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

    // Clear the bad Wikipedia data
    await sql`
      UPDATE artists SET
        wikipedia_url = NULL,
        bio = NULL,
        image_url = NULL,
        nationality = NULL,
        birth_year = NULL,
        death_year = NULL,
        verified = false,
        updated_at = NOW()
      WHERE id = ${artist.id}
    `;

    // Also check printers table for same name
    const printerResult = await sql`SELECT * FROM printers WHERE LOWER(name) = LOWER(${artist.name})`;
    if (printerResult.rows.length > 0) {
      await sql`
        UPDATE printers SET
          wikipedia_url = NULL,
          bio = NULL,
          image_url = NULL,
          verified = false,
          updated_at = NOW()
        WHERE LOWER(name) = LOWER(${artist.name})
      `;
    }

    return NextResponse.json({
      success: true,
      message: `Cleared Wikipedia data for artist "${artist.name}" (ID: ${artist.id})`,
      printerAlsoCleared: printerResult.rows.length > 0,
    });
  } catch (error) {
    console.error('Error fixing artist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
