import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/dealers
 * Create the dealers table for the dealer database feature
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Create dealers table
    await sql`
      CREATE TABLE IF NOT EXISTS dealers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        website VARCHAR(500),

        country VARCHAR(100),
        city VARCHAR(100),
        region VARCHAR(100),

        email VARCHAR(255),
        phone VARCHAR(50),

        reliability_tier INTEGER NOT NULL DEFAULT 3,
        attribution_weight DECIMAL(3,2) DEFAULT 0.70,
        pricing_weight DECIMAL(3,2) DEFAULT 0.70,

        can_research BOOLEAN DEFAULT true,
        can_price BOOLEAN DEFAULT true,
        can_procure BOOLEAN DEFAULT false,
        can_be_source BOOLEAN DEFAULT true,

        search_url_template VARCHAR(500),
        search_sold_url_template VARCHAR(500),

        specializations JSONB DEFAULT '[]',

        linked_seller_id INTEGER REFERENCES private_sellers(id) ON DELETE SET NULL,

        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Created dealers table');

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_dealers_slug ON dealers (slug)
    `;
    results.push('Created index on slug');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_dealers_type ON dealers (type)
    `;
    results.push('Created index on type');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_dealers_region ON dealers (region)
    `;
    results.push('Created index on region');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_dealers_reliability_tier ON dealers (reliability_tier)
    `;
    results.push('Created index on reliability_tier');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_dealers_is_active ON dealers (is_active)
    `;
    results.push('Created index on is_active');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_dealers_linked_seller ON dealers (linked_seller_id)
    `;
    results.push('Created index on linked_seller_id');

    return NextResponse.json({
      success: true,
      message: 'Dealers migration completed successfully',
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
