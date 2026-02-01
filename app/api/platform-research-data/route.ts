import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import type { PlatformResearchData } from '@/types/poster';

/**
 * Transform database row to PlatformResearchData
 */
function dbRowToPlatformResearchData(row: any): PlatformResearchData {
  return {
    id: row.id,
    platformName: row.platform_name,
    url: row.url,
    username: row.username,
    password: row.password,
    isResearchSite: row.is_research_site,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * GET /api/platform-research-data
 * Get all platform research data or search by name
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get('search');
    const platformName = request.nextUrl.searchParams.get('platformName');

    let result;

    if (platformName) {
      // Exact match by platform name
      result = await sql`
        SELECT * FROM platform_research_data
        WHERE LOWER(platform_name) = LOWER(${platformName})
        LIMIT 1
      `;
    } else if (search) {
      // Search by partial match
      const searchTerm = `%${search}%`;
      result = await sql`
        SELECT * FROM platform_research_data
        WHERE platform_name ILIKE ${searchTerm}
        ORDER BY platform_name ASC
      `;
    } else {
      // Get all
      result = await sql`
        SELECT * FROM platform_research_data
        ORDER BY platform_name ASC
      `;
    }

    const items = result.rows.map(dbRowToPlatformResearchData);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Platform research data GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform research data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/platform-research-data
 * Create new platform research data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.platformName) {
      return NextResponse.json({ error: 'platformName is required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO platform_research_data (
        platform_name,
        url,
        username,
        password,
        is_research_site,
        notes
      )
      VALUES (
        ${body.platformName},
        ${body.url || null},
        ${body.username || null},
        ${body.password || null},
        ${body.isResearchSite || false},
        ${body.notes || null}
      )
      RETURNING *
    `;

    const item = dbRowToPlatformResearchData(result.rows[0]);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Platform research data POST error:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Platform research data already exists for this platform' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create platform research data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/platform-research-data?id=123
 * Update platform research data
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
      UPDATE platform_research_data
      SET
        platform_name = ${body.platformName},
        url = ${body.url || null},
        username = ${body.username || null},
        password = ${body.password || null},
        is_research_site = ${body.isResearchSite || false},
        notes = ${body.notes || null},
        updated_at = NOW()
      WHERE id = ${idNum}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Platform research data not found' }, { status: 404 });
    }

    const item = dbRowToPlatformResearchData(result.rows[0]);
    return NextResponse.json({ item });
  } catch (error) {
    console.error('Platform research data PUT error:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Platform research data already exists for this platform' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update platform research data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/platform-research-data?id=123
 * Delete platform research data
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
      DELETE FROM platform_research_data
      WHERE id = ${idNum}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Platform research data not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: idNum });
  } catch (error) {
    console.error('Platform research data DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete platform research data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
