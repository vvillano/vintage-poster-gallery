import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/products-index
 * Create the products_index table for the advanced product grid.
 * Stores a local snapshot of all Shopify products with key metafields
 * for fast filtering, sorting, and searching.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Create products_index table
    await sql`
      CREATE TABLE IF NOT EXISTS products_index (
        id SERIAL PRIMARY KEY,
        shopify_product_id BIGINT NOT NULL UNIQUE,
        shopify_gid TEXT NOT NULL,
        handle TEXT,
        title TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        product_type TEXT,
        tags TEXT,

        sku TEXT,
        price NUMERIC(10,2),
        compare_at_price NUMERIC(10,2),
        inventory_quantity INTEGER,

        thumbnail_url TEXT,

        year TEXT,
        artist TEXT,
        country_of_origin TEXT,
        source_platform TEXT,
        purchase_price NUMERIC(10,2),
        shipping NUMERIC(10,2),
        restoration NUMERIC(10,2),
        total_cogs NUMERIC(10,2),

        internal_tags TEXT,

        local_poster_id INTEGER,

        shopify_created_at TIMESTAMPTZ,
        shopify_updated_at TIMESTAMPTZ,
        synced_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    results.push('Created products_index table');

    // Create indexes for filtering
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_status ON products_index(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_product_type ON products_index(product_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_artist ON products_index(artist)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_country ON products_index(country_of_origin)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_source_platform ON products_index(source_platform)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_year ON products_index(year)`;
    results.push('Created filtering indexes');

    // Create indexes for search
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_title ON products_index(title)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_sku ON products_index(sku)`;
    results.push('Created search indexes');

    // Create indexes for sorting
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_updated_at ON products_index(shopify_updated_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_price ON products_index(price)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pi_total_cogs ON products_index(total_cogs)`;
    results.push('Created sorting indexes');

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Products index migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}
