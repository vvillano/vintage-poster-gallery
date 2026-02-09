import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import type { PrivateSeller, PlatformIdentity, PrivateSellerType } from '@/types/poster';

/**
 * Transform database row to PrivateSeller
 */
function dbRowToPrivateSeller(row: any): PrivateSeller {
  return {
    id: row.id,
    name: row.name,
    sellerType: row.seller_type as PrivateSellerType,
    email: row.email,
    phone: row.phone,
    url: row.url,
    username: row.username,
    password: row.password,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Transform database row to PlatformIdentity
 */
function dbRowToPlatformIdentity(row: any): PlatformIdentity {
  return {
    id: row.id,
    platformName: row.platform_name,
    platformUsername: row.platform_username,
    sellerId: row.seller_id,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * GET /api/private-sellers
 * Get all private sellers or search, with optional platform identities
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get('search');
    const id = request.nextUrl.searchParams.get('id');
    const includeIdentities = request.nextUrl.searchParams.get('includeIdentities') === 'true';

    let result;

    if (id) {
      // Get single seller by ID
      result = await sql`
        SELECT * FROM private_sellers
        WHERE id = ${parseInt(id)}
        LIMIT 1
      `;
    } else if (search) {
      // Search by name, email, or notes
      const searchTerm = `%${search}%`;
      result = await sql`
        SELECT * FROM private_sellers
        WHERE name ILIKE ${searchTerm}
           OR email ILIKE ${searchTerm}
           OR notes ILIKE ${searchTerm}
        ORDER BY name ASC
      `;
    } else {
      // Get all
      result = await sql`
        SELECT * FROM private_sellers
        ORDER BY name ASC
      `;
    }

    let items = result.rows.map(dbRowToPrivateSeller);

    // Optionally include platform identities for each seller
    if (includeIdentities && items.length > 0) {
      const sellerIds = items.map(s => s.id);
      const sellerIdsArray = `{${sellerIds.join(',')}}`;
      const identitiesResult = await sql`
        SELECT * FROM platform_identities
        WHERE seller_id = ANY(${sellerIdsArray}::int[])
        ORDER BY platform_name ASC
      `;

      const identitiesBySeller = new Map<number, PlatformIdentity[]>();
      for (const row of identitiesResult.rows) {
        const identity = dbRowToPlatformIdentity(row);
        if (identity.sellerId) {
          if (!identitiesBySeller.has(identity.sellerId)) {
            identitiesBySeller.set(identity.sellerId, []);
          }
          identitiesBySeller.get(identity.sellerId)!.push(identity);
        }
      }

      items = items.map(seller => ({
        ...seller,
        platformIdentities: identitiesBySeller.get(seller.id) || [],
      }));
    }

    // If fetching single seller by ID, return single item
    if (id) {
      return NextResponse.json({ item: items[0] || null });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Private sellers GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch private sellers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/private-sellers
 * Create a new private seller
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO private_sellers (
        name,
        seller_type,
        email,
        phone,
        url,
        username,
        password,
        notes
      )
      VALUES (
        ${body.name},
        ${body.sellerType || 'dealer'},
        ${body.email || null},
        ${body.phone || null},
        ${body.url || null},
        ${body.username || null},
        ${body.password || null},
        ${body.notes || null}
      )
      RETURNING *
    `;

    const item = dbRowToPrivateSeller(result.rows[0]);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Private sellers POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create private seller', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/private-sellers?id=123
 * Update a private seller
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
      UPDATE private_sellers
      SET
        name = ${body.name},
        seller_type = ${body.sellerType || 'dealer'},
        email = ${body.email || null},
        phone = ${body.phone || null},
        url = ${body.url || null},
        username = ${body.username || null},
        password = ${body.password || null},
        notes = ${body.notes || null},
        updated_at = NOW()
      WHERE id = ${idNum}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Private seller not found' }, { status: 404 });
    }

    const item = dbRowToPrivateSeller(result.rows[0]);
    return NextResponse.json({ item });
  } catch (error) {
    console.error('Private sellers PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update private seller', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/private-sellers?id=123
 * Delete a private seller (platform identities are set to null via ON DELETE SET NULL)
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
      DELETE FROM private_sellers
      WHERE id = ${idNum}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Private seller not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: idNum });
  } catch (error) {
    console.error('Private sellers DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete private seller', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
