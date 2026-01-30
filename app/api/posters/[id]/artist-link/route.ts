import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/posters/[id]/artist-link
 * Link a poster to an artist
 * Body: { artistId: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const posterId = parseInt(id);
    const body = await request.json();
    const { artistId } = body;

    if (!artistId) {
      return NextResponse.json(
        { error: 'artistId is required' },
        { status: 400 }
      );
    }

    // Verify artist exists
    const artistResult = await sql`
      SELECT id, name, verified FROM artists WHERE id = ${artistId}
    `;

    if (artistResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    // Link poster to artist
    const result = await sql`
      UPDATE posters
      SET artist_id = ${artistId}, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, artist_id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Poster not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      posterId,
      artistId,
      artistName: artistResult.rows[0].name,
      artistVerified: artistResult.rows[0].verified,
    });
  } catch (error) {
    console.error('Link artist error:', error);
    return NextResponse.json(
      { error: 'Failed to link artist', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posters/[id]/artist-link
 * Unlink an artist from a poster
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const posterId = parseInt(id);

    // Unlink artist from poster
    const result = await sql`
      UPDATE posters
      SET artist_id = NULL, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, artist_id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Poster not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      posterId,
      message: 'Artist unlinked successfully',
    });
  } catch (error) {
    console.error('Unlink artist error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink artist', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/posters/[id]/artist-link
 * Get the linked artist for a poster
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const posterId = parseInt(id);

    // Get poster's linked artist with full artist details
    const result = await sql`
      SELECT
        p.id as poster_id,
        p.artist_id,
        a.id as artist_id,
        a.name,
        a.aliases,
        a.nationality,
        a.birth_year,
        a.death_year,
        a.wikipedia_url,
        a.bio,
        a.image_url,
        a.verified
      FROM posters p
      LEFT JOIN artists a ON p.artist_id = a.id
      WHERE p.id = ${posterId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Poster not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    if (!row.artist_id) {
      return NextResponse.json({
        linked: false,
        artist: null,
      });
    }

    return NextResponse.json({
      linked: true,
      artist: {
        id: row.artist_id,
        name: row.name,
        aliases: row.aliases || [],
        nationality: row.nationality,
        birthYear: row.birth_year,
        deathYear: row.death_year,
        wikipediaUrl: row.wikipedia_url,
        bio: row.bio,
        imageUrl: row.image_url,
        verified: row.verified,
      },
    });
  } catch (error) {
    console.error('Get linked artist error:', error);
    return NextResponse.json(
      { error: 'Failed to get linked artist', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
