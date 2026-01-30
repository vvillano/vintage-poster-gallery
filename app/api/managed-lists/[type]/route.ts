import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

// Valid list types and their table configurations
const LIST_CONFIGS = {
  'media-types': {
    table: 'media_types',
    columns: ['id', 'name', 'display_order', 'created_at'],
    insertColumns: ['name', 'display_order'],
    updateColumns: ['name', 'display_order'],
  },
  'artists': {
    table: 'artists',
    columns: ['id', 'name', 'aliases', 'nationality', 'birth_year', 'death_year', 'notes', 'created_at', 'updated_at'],
    insertColumns: ['name', 'aliases', 'nationality', 'birth_year', 'death_year', 'notes'],
    updateColumns: ['name', 'aliases', 'nationality', 'birth_year', 'death_year', 'notes', 'updated_at'],
  },
  'internal-tags': {
    table: 'internal_tags',
    columns: ['id', 'name', 'color', 'display_order', 'created_at'],
    insertColumns: ['name', 'color', 'display_order'],
    updateColumns: ['name', 'color', 'display_order'],
  },
  'source-platforms': {
    table: 'source_platforms',
    columns: ['id', 'name', 'url_template', 'display_order', 'created_at'],
    insertColumns: ['name', 'url_template', 'display_order'],
    updateColumns: ['name', 'url_template', 'display_order'],
  },
  'locations': {
    table: 'locations',
    columns: ['id', 'name', 'description', 'display_order', 'created_at'],
    insertColumns: ['name', 'description', 'display_order'],
    updateColumns: ['name', 'description', 'display_order'],
  },
  'countries': {
    table: 'countries',
    columns: ['id', 'name', 'code', 'display_order', 'created_at'],
    insertColumns: ['name', 'code', 'display_order'],
    updateColumns: ['name', 'code', 'display_order'],
  },
} as const;

type ListType = keyof typeof LIST_CONFIGS;

function isValidListType(type: string): type is ListType {
  return type in LIST_CONFIGS;
}

/**
 * GET /api/managed-lists/[type]
 * Get all items in a managed list
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await params;

    if (!isValidListType(type)) {
      return NextResponse.json(
        { error: `Invalid list type: ${type}` },
        { status: 400 }
      );
    }

    const config = LIST_CONFIGS[type];

    // Build query based on table type
    let result;
    if (type === 'artists') {
      result = await sql.query(
        `SELECT * FROM ${config.table} ORDER BY name ASC`
      );
    } else {
      result = await sql.query(
        `SELECT * FROM ${config.table} ORDER BY display_order ASC, name ASC`
      );
    }

    // Transform column names to camelCase
    const items = result.rows.map(row => transformRow(row, type));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Managed list GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch list', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/managed-lists/[type]
 * Create a new item in a managed list
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await params;

    if (!isValidListType(type)) {
      return NextResponse.json(
        { error: `Invalid list type: ${type}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const config = LIST_CONFIGS[type];

    // Build insert query based on type
    let result;

    switch (type) {
      case 'media-types':
        result = await sql`
          INSERT INTO media_types (name, display_order)
          VALUES (${body.name}, ${body.displayOrder || 0})
          RETURNING *
        `;
        break;
      case 'artists': {
        // Convert aliases array to PostgreSQL array literal
        const aliasesArray = body.aliases || [];
        const aliasesLiteral = aliasesArray.length > 0
          ? `{${aliasesArray.map((a: string) => `"${a.replace(/"/g, '\\"')}"`).join(',')}}`
          : null;
        result = await sql`
          INSERT INTO artists (name, aliases, nationality, birth_year, death_year, notes)
          VALUES (
            ${body.name},
            ${aliasesLiteral}::TEXT[],
            ${body.nationality || null},
            ${body.birthYear || null},
            ${body.deathYear || null},
            ${body.notes || null}
          )
          RETURNING *
        `;
        break;
      }
      case 'internal-tags':
        result = await sql`
          INSERT INTO internal_tags (name, color, display_order)
          VALUES (${body.name}, ${body.color || '#6B7280'}, ${body.displayOrder || 0})
          RETURNING *
        `;
        break;
      case 'source-platforms':
        result = await sql`
          INSERT INTO source_platforms (name, url_template, display_order)
          VALUES (${body.name}, ${body.urlTemplate || null}, ${body.displayOrder || 0})
          RETURNING *
        `;
        break;
      case 'locations':
        result = await sql`
          INSERT INTO locations (name, description, display_order)
          VALUES (${body.name}, ${body.description || null}, ${body.displayOrder || 0})
          RETURNING *
        `;
        break;
      case 'countries':
        result = await sql`
          INSERT INTO countries (name, code, display_order)
          VALUES (${body.name}, ${body.code || null}, ${body.displayOrder || 0})
          RETURNING *
        `;
        break;
    }

    const item = transformRow(result.rows[0], type);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Managed list POST error:', error);

    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'An item with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create item', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/managed-lists/[type]?id=123
 * Update an item in a managed list
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await params;
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    }

    if (!isValidListType(type)) {
      return NextResponse.json(
        { error: `Invalid list type: ${type}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const idNum = parseInt(id);

    // Build update query based on type
    let result;

    switch (type) {
      case 'media-types':
        result = await sql`
          UPDATE media_types
          SET name = ${body.name}, display_order = ${body.displayOrder || 0}
          WHERE id = ${idNum}
          RETURNING *
        `;
        break;
      case 'artists': {
        // Convert aliases array to PostgreSQL array literal
        const aliasesArray = body.aliases || [];
        const aliasesLiteral = aliasesArray.length > 0
          ? `{${aliasesArray.map((a: string) => `"${a.replace(/"/g, '\\"')}"`).join(',')}}`
          : null;
        result = await sql`
          UPDATE artists
          SET
            name = ${body.name},
            aliases = ${aliasesLiteral}::TEXT[],
            nationality = ${body.nationality || null},
            birth_year = ${body.birthYear || null},
            death_year = ${body.deathYear || null},
            notes = ${body.notes || null},
            updated_at = NOW()
          WHERE id = ${idNum}
          RETURNING *
        `;
        break;
      }
      case 'internal-tags':
        result = await sql`
          UPDATE internal_tags
          SET name = ${body.name}, color = ${body.color || '#6B7280'}, display_order = ${body.displayOrder || 0}
          WHERE id = ${idNum}
          RETURNING *
        `;
        break;
      case 'source-platforms':
        result = await sql`
          UPDATE source_platforms
          SET name = ${body.name}, url_template = ${body.urlTemplate || null}, display_order = ${body.displayOrder || 0}
          WHERE id = ${idNum}
          RETURNING *
        `;
        break;
      case 'locations':
        result = await sql`
          UPDATE locations
          SET name = ${body.name}, description = ${body.description || null}, display_order = ${body.displayOrder || 0}
          WHERE id = ${idNum}
          RETURNING *
        `;
        break;
      case 'countries':
        result = await sql`
          UPDATE countries
          SET name = ${body.name}, code = ${body.code || null}, display_order = ${body.displayOrder || 0}
          WHERE id = ${idNum}
          RETURNING *
        `;
        break;
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const item = transformRow(result.rows[0], type);
    return NextResponse.json({ item });
  } catch (error) {
    console.error('Managed list PUT error:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { error: 'An item with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update item', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/managed-lists/[type]?id=123
 * Delete an item from a managed list
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await params;
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    }

    if (!isValidListType(type)) {
      return NextResponse.json(
        { error: `Invalid list type: ${type}` },
        { status: 400 }
      );
    }

    const config = LIST_CONFIGS[type];
    const idNum = parseInt(id);

    const result = await sql.query(
      `DELETE FROM ${config.table} WHERE id = $1 RETURNING id`,
      [idNum]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: idNum });
  } catch (error) {
    console.error('Managed list DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete item', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Transform database row to camelCase for frontend
 */
function transformRow(row: Record<string, unknown>, type: ListType): Record<string, unknown> {
  const transformed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    transformed[camelKey] = value;
  }

  return transformed;
}
