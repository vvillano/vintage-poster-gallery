import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/posters/[id]/publication-link
 * Link a poster to a publication
 * Body: { publicationId: number }
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
    const { publicationId } = body;

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publicationId is required' },
        { status: 400 }
      );
    }

    // Verify publication exists
    const pubResult = await sql`
      SELECT id, title, verified FROM publications WHERE id = ${publicationId}
    `;

    if (pubResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Publication not found' },
        { status: 404 }
      );
    }

    // Link poster to publication
    const result = await sql`
      UPDATE posters
      SET publication_id = ${publicationId}, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, publication_id
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
      publicationId,
      publicationTitle: pubResult.rows[0].title,
      publicationVerified: pubResult.rows[0].verified,
    });
  } catch (error) {
    console.error('Link publication error:', error);
    return NextResponse.json(
      { error: 'Failed to link publication', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posters/[id]/publication-link
 * Unlink a publication from a poster
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

    // Unlink publication from poster
    const result = await sql`
      UPDATE posters
      SET publication_id = NULL, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, publication_id
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
      message: 'Publication unlinked successfully',
    });
  } catch (error) {
    console.error('Unlink publication error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink publication', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/posters/[id]/publication-link
 * Get the linked publication for a poster
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

    // Get poster's linked publication with full details
    const result = await sql`
      SELECT
        p.id as poster_id,
        p.publication_id,
        pub.id as pub_id,
        pub.title,
        pub.author,
        pub.publication_year,
        pub.publisher_id,
        pub.contributors,
        pub.country,
        pub.edition,
        pub.volume_info,
        pub.notes,
        pub.wikipedia_url,
        pub.bio,
        pub.image_url,
        pub.verified
      FROM posters p
      LEFT JOIN publications pub ON p.publication_id = pub.id
      WHERE p.id = ${posterId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Poster not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    if (!row.publication_id) {
      return NextResponse.json({
        linked: false,
        publication: null,
      });
    }

    return NextResponse.json({
      linked: true,
      publication: {
        id: row.pub_id,
        title: row.title,
        author: row.author,
        publicationYear: row.publication_year,
        publisherId: row.publisher_id,
        contributors: row.contributors,
        country: row.country,
        edition: row.edition,
        volumeInfo: row.volume_info,
        notes: row.notes,
        wikipediaUrl: row.wikipedia_url,
        bio: row.bio,
        imageUrl: row.image_url,
        verified: row.verified,
      },
    });
  } catch (error) {
    console.error('Get linked publication error:', error);
    return NextResponse.json(
      { error: 'Failed to get linked publication', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
