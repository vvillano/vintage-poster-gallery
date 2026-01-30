import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/posters/[id]/publisher-link
 * Link a poster to a publisher
 * Body: { publisherId: number }
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
    const { publisherId } = body;

    if (!publisherId) {
      return NextResponse.json(
        { error: 'publisherId is required' },
        { status: 400 }
      );
    }

    // Verify publisher exists
    const publisherResult = await sql`
      SELECT id, name, verified FROM publishers WHERE id = ${publisherId}
    `;

    if (publisherResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Publisher not found' },
        { status: 404 }
      );
    }

    // Link poster to publisher
    const result = await sql`
      UPDATE posters
      SET publisher_id = ${publisherId}, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, publisher_id
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
      publisherId,
      publisherName: publisherResult.rows[0].name,
      publisherVerified: publisherResult.rows[0].verified,
    });
  } catch (error) {
    console.error('Link publisher error:', error);
    return NextResponse.json(
      { error: 'Failed to link publisher', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posters/[id]/publisher-link
 * Unlink a publisher from a poster
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

    // Unlink publisher from poster
    const result = await sql`
      UPDATE posters
      SET publisher_id = NULL, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, publisher_id
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
      message: 'Publisher unlinked successfully',
    });
  } catch (error) {
    console.error('Unlink publisher error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink publisher', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/posters/[id]/publisher-link
 * Get the linked publisher for a poster
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

    // Get poster's linked publisher with full details
    const result = await sql`
      SELECT
        p.id as poster_id,
        p.publisher_id,
        pub.id as publisher_id,
        pub.name,
        pub.aliases,
        pub.publication_type,
        pub.country,
        pub.founded_year,
        pub.ceased_year,
        pub.wikipedia_url,
        pub.bio,
        pub.image_url,
        pub.verified
      FROM posters p
      LEFT JOIN publishers pub ON p.publisher_id = pub.id
      WHERE p.id = ${posterId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Poster not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    if (!row.publisher_id) {
      return NextResponse.json({
        linked: false,
        publisher: null,
      });
    }

    return NextResponse.json({
      linked: true,
      publisher: {
        id: row.publisher_id,
        name: row.name,
        aliases: row.aliases || [],
        publicationType: row.publication_type,
        country: row.country,
        foundedYear: row.founded_year,
        ceasedYear: row.ceased_year,
        wikipediaUrl: row.wikipedia_url,
        bio: row.bio,
        imageUrl: row.image_url,
        verified: row.verified,
      },
    });
  } catch (error) {
    console.error('Get linked publisher error:', error);
    return NextResponse.json(
      { error: 'Failed to get linked publisher', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
