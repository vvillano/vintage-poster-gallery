import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * Platform interface for the unified platforms table
 */
interface Platform {
  id: number;
  name: string;
  url: string | null;
  searchUrlTemplate: string | null;
  isAcquisitionPlatform: boolean;
  isResearchSite: boolean;
  requiresSubscription: boolean;
  username: string | null;
  password: string | null;
  displayOrder: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transform database row to Platform
 */
function dbRowToPlatform(row: Record<string, unknown>): Platform {
  return {
    id: row.id as number,
    name: row.name as string,
    url: row.url as string | null,
    searchUrlTemplate: row.search_url_template as string | null,
    isAcquisitionPlatform: row.is_acquisition_platform as boolean,
    isResearchSite: row.is_research_site as boolean,
    requiresSubscription: row.requires_subscription as boolean,
    username: row.username as string | null,
    password: row.password as string | null,
    displayOrder: row.display_order as number,
    notes: row.notes as string | null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * GET /api/platforms
 * Get all platforms or filter by type
 *
 * Query params:
 * - search: partial name match
 * - name: exact name match
 * - acquisition: filter to acquisition platforms only
 * - research: filter to research sites only
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get('search');
    const name = request.nextUrl.searchParams.get('name');
    const acquisitionOnly = request.nextUrl.searchParams.get('acquisition') === 'true';
    const researchOnly = request.nextUrl.searchParams.get('research') === 'true';

    let result;

    if (name) {
      // Exact match by name
      result = await sql`
        SELECT * FROM platforms
        WHERE LOWER(name) = LOWER(${name})
        LIMIT 1
      `;
    } else if (search) {
      // Search by partial match
      const searchTerm = `%${search}%`;
      if (acquisitionOnly) {
        result = await sql`
          SELECT * FROM platforms
          WHERE name ILIKE ${searchTerm} AND is_acquisition_platform = true
          ORDER BY name ASC
        `;
      } else if (researchOnly) {
        result = await sql`
          SELECT * FROM platforms
          WHERE name ILIKE ${searchTerm} AND is_research_site = true
          ORDER BY display_order ASC, name ASC
        `;
      } else {
        result = await sql`
          SELECT * FROM platforms
          WHERE name ILIKE ${searchTerm}
          ORDER BY name ASC
        `;
      }
    } else if (acquisitionOnly) {
      result = await sql`
        SELECT * FROM platforms
        WHERE is_acquisition_platform = true
        ORDER BY name ASC
      `;
    } else if (researchOnly) {
      result = await sql`
        SELECT * FROM platforms
        WHERE is_research_site = true
        ORDER BY display_order ASC, name ASC
      `;
    } else {
      // Get all
      result = await sql`
        SELECT * FROM platforms
        ORDER BY name ASC
      `;
    }

    const items = result.rows.map(dbRowToPlatform);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Platforms GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platforms', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/platforms
 * Create a new platform
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
      INSERT INTO platforms (
        name,
        url,
        search_url_template,
        is_acquisition_platform,
        is_research_site,
        requires_subscription,
        username,
        password,
        display_order,
        notes
      )
      VALUES (
        ${body.name},
        ${body.url || null},
        ${body.searchUrlTemplate || null},
        ${body.isAcquisitionPlatform || false},
        ${body.isResearchSite || false},
        ${body.requiresSubscription || false},
        ${body.username || null},
        ${body.password || null},
        ${body.displayOrder || 0},
        ${body.notes || null}
      )
      RETURNING *
    `;

    const item = dbRowToPlatform(result.rows[0]);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Platforms POST error:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'A platform with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create platform', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/platforms?id=123
 * Update a platform
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
      UPDATE platforms
      SET
        name = ${body.name},
        url = ${body.url || null},
        search_url_template = ${body.searchUrlTemplate || null},
        is_acquisition_platform = ${body.isAcquisitionPlatform || false},
        is_research_site = ${body.isResearchSite || false},
        requires_subscription = ${body.requiresSubscription || false},
        username = ${body.username || null},
        password = ${body.password || null},
        display_order = ${body.displayOrder || 0},
        notes = ${body.notes || null},
        updated_at = NOW()
      WHERE id = ${idNum}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    const item = dbRowToPlatform(result.rows[0]);
    return NextResponse.json({ item });
  } catch (error) {
    console.error('Platforms PUT error:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'A platform with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update platform', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/platforms?id=123
 * Delete a platform
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
      DELETE FROM platforms
      WHERE id = ${idNum}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: idNum });
  } catch (error) {
    console.error('Platforms DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete platform', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
