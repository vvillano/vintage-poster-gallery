import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/posters/[id]/printer-link
 * Link a poster to a printer
 * Body: { printerId: number }
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
    const { printerId } = body;

    if (!printerId) {
      return NextResponse.json(
        { error: 'printerId is required' },
        { status: 400 }
      );
    }

    // Verify printer exists
    const printerResult = await sql`
      SELECT id, name, verified FROM printers WHERE id = ${printerId}
    `;

    if (printerResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Printer not found' },
        { status: 404 }
      );
    }

    // Link poster to printer
    const result = await sql`
      UPDATE posters
      SET printer_id = ${printerId}, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, printer_id
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
      printerId,
      printerName: printerResult.rows[0].name,
      printerVerified: printerResult.rows[0].verified,
    });
  } catch (error) {
    console.error('Link printer error:', error);
    return NextResponse.json(
      { error: 'Failed to link printer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posters/[id]/printer-link
 * Unlink a printer from a poster
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

    // Unlink printer from poster
    const result = await sql`
      UPDATE posters
      SET printer_id = NULL, last_modified = NOW()
      WHERE id = ${posterId}
      RETURNING id, printer_id
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
      message: 'Printer unlinked successfully',
    });
  } catch (error) {
    console.error('Unlink printer error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink printer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/posters/[id]/printer-link
 * Get the linked printer for a poster
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

    // Get poster's linked printer with full details
    const result = await sql`
      SELECT
        p.id as poster_id,
        p.printer_id,
        pr.id as printer_id,
        pr.name,
        pr.aliases,
        pr.location,
        pr.country,
        pr.founded_year,
        pr.closed_year,
        pr.wikipedia_url,
        pr.bio,
        pr.image_url,
        pr.verified
      FROM posters p
      LEFT JOIN printers pr ON p.printer_id = pr.id
      WHERE p.id = ${posterId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Poster not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    if (!row.printer_id) {
      return NextResponse.json({
        linked: false,
        printer: null,
      });
    }

    return NextResponse.json({
      linked: true,
      printer: {
        id: row.printer_id,
        name: row.name,
        aliases: row.aliases || [],
        location: row.location,
        country: row.country,
        foundedYear: row.founded_year,
        closedYear: row.closed_year,
        wikipediaUrl: row.wikipedia_url,
        bio: row.bio,
        imageUrl: row.image_url,
        verified: row.verified,
      },
    });
  } catch (error) {
    console.error('Get linked printer error:', error);
    return NextResponse.json(
      { error: 'Failed to get linked printer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
