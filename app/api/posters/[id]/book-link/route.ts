import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/posters/[id]/book-link
 * Link a poster to a book
 * Body: { bookId: number }
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
    const { bookId } = body;

    if (!bookId) {
      return NextResponse.json(
        { error: 'bookId is required' },
        { status: 400 }
      );
    }

    // Verify book exists
    const bookResult = await sql`
      SELECT id, title, verified FROM books WHERE id = ${bookId}
    `;

    if (bookResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Link poster to book
    const result = await sql`
      UPDATE posters
      SET book_id = ${bookId}, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, book_id
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
      bookId,
      bookTitle: bookResult.rows[0].title,
      bookVerified: bookResult.rows[0].verified,
    });
  } catch (error) {
    console.error('Link book error:', error);
    return NextResponse.json(
      { error: 'Failed to link book', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posters/[id]/book-link
 * Unlink a book from a poster
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

    // Unlink book from poster
    const result = await sql`
      UPDATE posters
      SET book_id = NULL, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, book_id
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
      message: 'Book unlinked successfully',
    });
  } catch (error) {
    console.error('Unlink book error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink book', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/posters/[id]/book-link
 * Get the linked book for a poster
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

    // Get poster's linked book with full details
    const result = await sql`
      SELECT
        p.id as poster_id,
        p.book_id,
        b.id as book_id,
        b.title,
        b.author,
        b.publication_year,
        b.publisher_id,
        b.contributors,
        b.country,
        b.edition,
        b.volume_info,
        b.notes,
        b.wikipedia_url,
        b.bio,
        b.image_url,
        b.verified
      FROM posters p
      LEFT JOIN books b ON p.book_id = b.id
      WHERE p.id = ${posterId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Poster not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    if (!row.book_id) {
      return NextResponse.json({
        linked: false,
        book: null,
      });
    }

    return NextResponse.json({
      linked: true,
      book: {
        id: row.book_id,
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
    console.error('Get linked book error:', error);
    return NextResponse.json(
      { error: 'Failed to get linked book', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
