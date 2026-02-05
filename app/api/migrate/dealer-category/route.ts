import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/dealer-category
 * Add category column to dealers table for separating:
 * - dealer: Auction houses, poster dealers, galleries (for both Research & Valuation)
 * - research: Museums/institutions (for Research only)
 * - platform: Marketplaces/aggregators (for both Research & Valuation)
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Add category column with default 'dealer'
    await sql`
      ALTER TABLE dealers
      ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'dealer'
    `;
    results.push('Added category column');

    // Create index for filtering by category
    await sql`
      CREATE INDEX IF NOT EXISTS idx_dealers_category
      ON dealers (category)
    `;
    results.push('Created index on category');

    // Backfill existing records based on their type
    // Museums → research
    const museumResult = await sql`
      UPDATE dealers
      SET category = 'research'
      WHERE type = 'museum' AND (category IS NULL OR category = 'dealer')
    `;
    results.push(`Updated ${museumResult.rowCount} museum records to category=research`);

    // Marketplaces and aggregators → platform
    const platformResult = await sql`
      UPDATE dealers
      SET category = 'platform'
      WHERE type IN ('aggregator', 'marketplace') AND (category IS NULL OR category = 'dealer')
    `;
    results.push(`Updated ${platformResult.rowCount} marketplace/aggregator records to category=platform`);

    // All other types remain 'dealer' (the default)
    results.push('All other dealer types remain as category=dealer');

    return NextResponse.json({
      success: true,
      message: 'Dealer category migration completed successfully',
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
 * GET /api/migrate/dealer-category
 * Check migration status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if category column exists
    const columnCheck = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'dealers' AND column_name = 'category'
    `;

    if (columnCheck.rows.length === 0) {
      return NextResponse.json({
        migrated: false,
        message: 'Category column does not exist. Run POST to migrate.',
      });
    }

    // Get category distribution
    const distribution = await sql`
      SELECT category, COUNT(*) as count
      FROM dealers
      GROUP BY category
      ORDER BY category
    `;

    return NextResponse.json({
      migrated: true,
      message: 'Category column exists',
      distribution: distribution.rows,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      {
        error: 'Status check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
