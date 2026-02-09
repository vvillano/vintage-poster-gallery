import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import type { PlatformIdentity, PrivateSeller, PrivateSellerType } from '@/types/poster';

/**
 * Transform database row to PlatformIdentity with optional seller
 */
function dbRowToPlatformIdentity(row: any, includesSeller = false): PlatformIdentity {
  const identity: PlatformIdentity = {
    id: row.id,
    platformName: row.platform_name,
    platformUsername: row.platform_username,
    sellerId: row.seller_id,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  // If seller data is joined
  if (includesSeller && row.seller_id && row.seller_name) {
    identity.seller = {
      id: row.seller_id,
      name: row.seller_name,
      sellerType: row.seller_type as PrivateSellerType,
      email: row.seller_email,
      phone: row.seller_phone,
      url: row.seller_url,
      username: row.seller_username,
      password: row.seller_password,
      notes: row.seller_notes,
      createdAt: new Date(row.seller_created_at),
      updatedAt: new Date(row.seller_updated_at),
    };
  }

  return identity;
}

/**
 * GET /api/platform-identities
 * Get platform identities with optional filters and seller join
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get('search');
    const platform = request.nextUrl.searchParams.get('platform');
    const username = request.nextUrl.searchParams.get('username');
    const unlinkedOnly = request.nextUrl.searchParams.get('unlinkedOnly') === 'true';
    const includeSeller = request.nextUrl.searchParams.get('includeSeller') === 'true';

    let result;

    if (platform && username) {
      // Exact match by platform + username
      if (includeSeller) {
        result = await sql`
          SELECT
            pi.*,
            ps.name as seller_name,
            ps.seller_type,
            ps.email as seller_email,
            ps.phone as seller_phone,
            ps.url as seller_url,
            ps.username as seller_username,
            ps.password as seller_password,
            ps.notes as seller_notes,
            ps.created_at as seller_created_at,
            ps.updated_at as seller_updated_at
          FROM platform_identities pi
          LEFT JOIN private_sellers ps ON pi.seller_id = ps.id
          WHERE LOWER(pi.platform_name) = LOWER(${platform})
            AND LOWER(pi.platform_username) = LOWER(${username})
          LIMIT 1
        `;
      } else {
        result = await sql`
          SELECT * FROM platform_identities
          WHERE LOWER(platform_name) = LOWER(${platform})
            AND LOWER(platform_username) = LOWER(${username})
          LIMIT 1
        `;
      }
    } else if (unlinkedOnly) {
      // Get only unlinked identities (no seller_id)
      result = await sql`
        SELECT * FROM platform_identities
        WHERE seller_id IS NULL
        ORDER BY platform_name ASC, platform_username ASC
      `;
    } else if (search) {
      // Search by platform or username
      const searchTerm = `%${search}%`;
      if (includeSeller) {
        result = await sql`
          SELECT
            pi.*,
            ps.name as seller_name,
            ps.seller_type,
            ps.email as seller_email,
            ps.phone as seller_phone,
            ps.url as seller_url,
            ps.username as seller_username,
            ps.password as seller_password,
            ps.notes as seller_notes,
            ps.created_at as seller_created_at,
            ps.updated_at as seller_updated_at
          FROM platform_identities pi
          LEFT JOIN private_sellers ps ON pi.seller_id = ps.id
          WHERE pi.platform_name ILIKE ${searchTerm}
             OR pi.platform_username ILIKE ${searchTerm}
          ORDER BY pi.platform_name ASC, pi.platform_username ASC
        `;
      } else {
        result = await sql`
          SELECT * FROM platform_identities
          WHERE platform_name ILIKE ${searchTerm}
             OR platform_username ILIKE ${searchTerm}
          ORDER BY platform_name ASC, platform_username ASC
        `;
      }
    } else {
      // Get all
      if (includeSeller) {
        result = await sql`
          SELECT
            pi.*,
            ps.name as seller_name,
            ps.seller_type,
            ps.email as seller_email,
            ps.phone as seller_phone,
            ps.url as seller_url,
            ps.username as seller_username,
            ps.password as seller_password,
            ps.notes as seller_notes,
            ps.created_at as seller_created_at,
            ps.updated_at as seller_updated_at
          FROM platform_identities pi
          LEFT JOIN private_sellers ps ON pi.seller_id = ps.id
          ORDER BY pi.platform_name ASC, pi.platform_username ASC
        `;
      } else {
        result = await sql`
          SELECT * FROM platform_identities
          ORDER BY platform_name ASC, platform_username ASC
        `;
      }
    }

    const items = result.rows.map(row => dbRowToPlatformIdentity(row, includeSeller));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Platform identities GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform identities', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/platform-identities
 * Create a new platform identity
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.platformName || !body.platformUsername) {
      return NextResponse.json(
        { error: 'platformName and platformUsername are required' },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO platform_identities (
        platform_name,
        platform_username,
        seller_id,
        notes
      )
      VALUES (
        ${body.platformName},
        ${body.platformUsername},
        ${body.sellerId || null},
        ${body.notes || null}
      )
      RETURNING *
    `;

    const item = dbRowToPlatformIdentity(result.rows[0]);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Platform identities POST error:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'This platform identity already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create platform identity', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/platform-identities?id=123
 * Update a platform identity (including linking to a seller)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    }

    const body = await request.json();
    const idNum = parseInt(id);

    const result = await sql`
      UPDATE platform_identities
      SET
        platform_name = ${body.platformName},
        platform_username = ${body.platformUsername},
        seller_id = ${body.sellerId || null},
        notes = ${body.notes || null},
        updated_at = NOW()
      WHERE id = ${idNum}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Platform identity not found' }, { status: 404 });
    }

    const item = dbRowToPlatformIdentity(result.rows[0]);
    return NextResponse.json({ item });
  } catch (error) {
    console.error('Platform identities PUT error:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'This platform identity already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update platform identity', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/platform-identities?id=123
 * Link/unlink a platform identity to a seller
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    }

    const body = await request.json();
    const idNum = parseInt(id);

    // Only update seller_id
    const result = await sql`
      UPDATE platform_identities
      SET
        seller_id = ${body.sellerId || null},
        updated_at = NOW()
      WHERE id = ${idNum}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Platform identity not found' }, { status: 404 });
    }

    const item = dbRowToPlatformIdentity(result.rows[0]);
    return NextResponse.json({ item });
  } catch (error) {
    console.error('Platform identities PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to link platform identity', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/platform-identities?id=123
 * Delete a platform identity
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    }

    const idNum = parseInt(id);

    const result = await sql`
      DELETE FROM platform_identities
      WHERE id = ${idNum}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Platform identity not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: idNum });
  } catch (error) {
    console.error('Platform identities DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete platform identity', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
