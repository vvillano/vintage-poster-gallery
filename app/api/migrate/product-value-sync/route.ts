import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/product-value-sync
 * Run the product value sync migration:
 * - Create colors table for managed list
 * - Add colors column to posters table (TEXT[] for multiple colors)
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // 1. Create colors table (managed list)
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS colors (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          hex_code VARCHAR(7),
          display_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      results.push('Created colors table');
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        results.push('colors table already exists');
      } else {
        throw err;
      }
    }

    // 2. Create index on colors table
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_colors_name ON colors(name)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_colors_order ON colors(display_order)`;
      results.push('Created indexes on colors table');
    } catch {
      results.push('Indexes on colors may already exist');
    }

    // 3. Seed colors table with common poster colors
    try {
      await sql`
        INSERT INTO colors (name, hex_code, display_order) VALUES
          ('Black', '#000000', 1),
          ('White', '#FFFFFF', 2),
          ('Red', '#FF0000', 3),
          ('Blue', '#0000FF', 4),
          ('Green', '#008000', 5),
          ('Yellow', '#FFFF00', 6),
          ('Orange', '#FFA500', 7),
          ('Purple', '#800080', 8),
          ('Pink', '#FFC0CB', 9),
          ('Brown', '#8B4513', 10),
          ('Gray', '#808080', 11),
          ('Gold', '#FFD700', 12),
          ('Silver', '#C0C0C0', 13),
          ('Beige', '#F5F5DC', 14),
          ('Cream', '#FFFDD0', 15),
          ('Navy', '#000080', 16),
          ('Teal', '#008080', 17),
          ('Maroon', '#800000', 18),
          ('Olive', '#808000', 19),
          ('Coral', '#FF7F50', 20),
          ('Turquoise', '#40E0D0', 21),
          ('Burgundy', '#800020', 22),
          ('Tan', '#D2B48C', 23),
          ('Sepia', '#704214', 24)
        ON CONFLICT (name) DO NOTHING
      `;
      results.push('Seeded colors table with common poster colors');
    } catch (err) {
      results.push(`Note: Some colors may already exist - ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // 4. Add colors column to posters table (TEXT[] for multiple colors)
    try {
      await sql`
        ALTER TABLE posters ADD COLUMN IF NOT EXISTS colors TEXT[]
      `;
      results.push('Added colors column to posters table');
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        results.push('colors column already exists on posters');
      } else {
        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Product value sync migration completed',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/migrate/product-value-sync
 * Check status of the migration
 */
export async function GET() {
  try {
    const status: Record<string, unknown> = {};

    // Check if colors table exists
    try {
      const result = await sql`SELECT COUNT(*) as count FROM colors`;
      status.colorsTableExists = true;
      status.colorsCount = parseInt(result.rows[0].count);
    } catch {
      status.colorsTableExists = false;
      status.colorsCount = 0;
    }

    // Check if colors column exists on posters
    try {
      await sql`SELECT colors FROM posters LIMIT 1`;
      status.colorsColumnExists = true;
    } catch {
      status.colorsColumnExists = false;
    }

    // Count posters with colors set
    if (status.colorsColumnExists) {
      try {
        const result = await sql`
          SELECT COUNT(*) as count FROM posters
          WHERE colors IS NOT NULL AND array_length(colors, 1) > 0
        `;
        status.postersWithColors = parseInt(result.rows[0].count);
      } catch {
        status.postersWithColors = 0;
      }
    }

    return NextResponse.json({
      status,
      migrationNeeded: !status.colorsTableExists || !status.colorsColumnExists,
    });
  } catch (error) {
    console.error('Migration status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
