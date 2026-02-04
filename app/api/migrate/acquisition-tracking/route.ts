import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/acquisition-tracking
 * Add acquisition tracking fields to support source/dealer/platform integration:
 * - platforms.platform_type: marketplace, aggregator, venue, research_only
 * - posters.source_dealer_id: WHO you bought from (FK to dealers)
 * - posters.acquisition_platform_id: WHERE/HOW you bought (FK to platforms)
 * - posters.dealer_name: Raw dealer name from Shopify for matching
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // 1. Add platform_type to platforms table
    // Values: marketplace, aggregator, venue, research_only
    try {
      await sql`
        ALTER TABLE platforms
        ADD COLUMN IF NOT EXISTS platform_type VARCHAR(50) DEFAULT 'marketplace'
      `;
      results.push('Added platform_type column to platforms table');
    } catch (err) {
      // Column might already exist
      if (err instanceof Error && !err.message.includes('already exists')) {
        throw err;
      }
      results.push('platform_type column already exists');
    }

    // 2. Add source_dealer_id to posters (WHO you bought from)
    try {
      await sql`
        ALTER TABLE posters
        ADD COLUMN IF NOT EXISTS source_dealer_id INTEGER REFERENCES dealers(id) ON DELETE SET NULL
      `;
      results.push('Added source_dealer_id column to posters table');
    } catch (err) {
      if (err instanceof Error && !err.message.includes('already exists')) {
        throw err;
      }
      results.push('source_dealer_id column already exists');
    }

    // 3. Add acquisition_platform_id to posters (WHERE/HOW you bought)
    try {
      await sql`
        ALTER TABLE posters
        ADD COLUMN IF NOT EXISTS acquisition_platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL
      `;
      results.push('Added acquisition_platform_id column to posters table');
    } catch (err) {
      if (err instanceof Error && !err.message.includes('already exists')) {
        throw err;
      }
      results.push('acquisition_platform_id column already exists');
    }

    // 4. Add dealer_name to posters (raw text from Shopify for matching)
    try {
      await sql`
        ALTER TABLE posters
        ADD COLUMN IF NOT EXISTS dealer_name VARCHAR(255)
      `;
      results.push('Added dealer_name column to posters table');
    } catch (err) {
      if (err instanceof Error && !err.message.includes('already exists')) {
        throw err;
      }
      results.push('dealer_name column already exists');
    }

    // 5. Create indexes for efficient lookups
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_posters_source_dealer ON posters(source_dealer_id)
      `;
      results.push('Created index on source_dealer_id');
    } catch {
      results.push('Index on source_dealer_id already exists');
    }

    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_posters_acquisition_platform ON posters(acquisition_platform_id)
      `;
      results.push('Created index on acquisition_platform_id');
    } catch {
      results.push('Index on acquisition_platform_id already exists');
    }

    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_platforms_platform_type ON platforms(platform_type)
      `;
      results.push('Created index on platform_type');
    } catch {
      results.push('Index on platform_type already exists');
    }

    return NextResponse.json({
      success: true,
      message: 'Acquisition tracking migration completed successfully',
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
