import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/resource-consolidation
 *
 * Consolidates resource partner entities:
 * - Adds platform_id and linked_seller_id to sellers table
 * - Migrates research_sites → platforms
 * - Migrates platform_identities → sellers (as type='individual')
 * - Adds generic platform categories
 */
export async function POST() {
  try {
    const results: string[] = [];

    // =====================================================
    // STEP 1: Add new columns to sellers table
    // =====================================================

    // Add platform_id column
    try {
      await sql`
        ALTER TABLE sellers
        ADD COLUMN IF NOT EXISTS platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL
      `;
      results.push('Added platform_id column to sellers');
    } catch (err) {
      results.push(`Note: ${err instanceof Error ? err.message : 'platform_id may already exist'}`);
    }

    // Add linked_seller_id column (for linking platform users to known dealers)
    try {
      await sql`
        ALTER TABLE sellers
        ADD COLUMN IF NOT EXISTS linked_seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL
      `;
      results.push('Added linked_seller_id column to sellers');
    } catch (err) {
      results.push(`Note: ${err instanceof Error ? err.message : 'linked_seller_id may already exist'}`);
    }

    // Create index on platform_id
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_sellers_platform_id ON sellers(platform_id)`;
      results.push('Created index on sellers.platform_id');
    } catch {
      results.push('Index on sellers.platform_id may already exist');
    }

    // =====================================================
    // STEP 2: Migrate research_sites → platforms
    // =====================================================

    try {
      // Check if research_sites table exists
      const tableCheck = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'research_sites'
      `;

      if (tableCheck.rows.length > 0) {
        // Migrate research sites to platforms
        const migrated = await sql`
          INSERT INTO platforms (name, url, search_url_template, requires_subscription, can_research_prices, is_acquisition_platform, platform_type, display_order)
          SELECT
            rs.name,
            rs.url_template,
            rs.url_template,
            rs.requires_subscription,
            true,
            false,
            'research',
            rs.display_order + 500
          FROM research_sites rs
          WHERE NOT EXISTS (
            SELECT 1 FROM platforms p WHERE LOWER(p.name) = LOWER(rs.name)
          )
          RETURNING name
        `;
        results.push(`Migrated ${migrated.rowCount} research sites to platforms`);
      } else {
        results.push('research_sites table does not exist - skipping migration');
      }
    } catch (err) {
      results.push(`Note migrating research_sites: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // =====================================================
    // STEP 3: Migrate platform_identities → sellers
    // =====================================================

    try {
      // Check if platform_identities table exists
      const tableCheck = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'platform_identities'
      `;

      if (tableCheck.rows.length > 0) {
        // Get platform identities with platform names
        const identities = await sql`
          SELECT
            pi.id,
            pi.platform_username,
            pi.platform_name,
            pi.platform_id,
            pi.seller_id,
            pi.notes,
            p.name as platform_name_from_fk
          FROM platform_identities pi
          LEFT JOIN platforms p ON pi.platform_id = p.id
        `;

        let migratedCount = 0;
        for (const identity of identities.rows) {
          const platformName = identity.platform_name_from_fk || identity.platform_name || 'Unknown';
          const sellerName = `${identity.platform_username} (${platformName})`;

          // Check if this seller already exists
          const existing = await sql`
            SELECT id FROM sellers WHERE LOWER(name) = LOWER(${sellerName})
          `;

          if (existing.rows.length === 0) {
            // Create new seller record
            await sql`
              INSERT INTO sellers (
                name, slug, type, platform_id, linked_seller_id, notes,
                reliability_tier, attribution_weight, pricing_weight, is_active
              )
              VALUES (
                ${sellerName},
                ${sellerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')},
                'individual',
                ${identity.platform_id},
                ${identity.seller_id},
                ${identity.notes},
                4,
                0.60,
                0.60,
                true
              )
            `;
            migratedCount++;
          }
        }
        results.push(`Migrated ${migratedCount} platform identities to sellers`);
      } else {
        results.push('platform_identities table does not exist - skipping migration');
      }
    } catch (err) {
      results.push(`Note migrating platform_identities: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // =====================================================
    // STEP 4: Add generic platform categories
    // =====================================================

    const genericPlatforms = [
      { name: 'Estate Sale (Generic)', type: 'venue', order: 200 },
      { name: 'Flea Market (Unknown)', type: 'venue', order: 201 },
      { name: 'Antique Store (Unknown)', type: 'venue', order: 202 },
      { name: 'Garage Sale', type: 'venue', order: 203 },
      { name: 'Thrift Store', type: 'venue', order: 204 },
      { name: 'Auction (Unknown)', type: 'venue', order: 205 },
    ];

    for (const platform of genericPlatforms) {
      try {
        const existing = await sql`SELECT id FROM platforms WHERE name = ${platform.name}`;
        if (existing.rows.length === 0) {
          await sql`
            INSERT INTO platforms (name, platform_type, is_acquisition_platform, can_research_prices, display_order)
            VALUES (${platform.name}, ${platform.type}, true, false, ${platform.order})
          `;
          results.push(`Added generic platform: ${platform.name}`);
        } else {
          results.push(`Generic platform already exists: ${platform.name}`);
        }
      } catch (err) {
        results.push(`Note adding ${platform.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // =====================================================
    // STEP 5: Add shopify_metaobject_id to platforms and sellers for sync
    // =====================================================

    try {
      await sql`
        ALTER TABLE platforms
        ADD COLUMN IF NOT EXISTS shopify_metaobject_id VARCHAR(100)
      `;
      results.push('Added shopify_metaobject_id column to platforms');
    } catch (err) {
      results.push(`Note: ${err instanceof Error ? err.message : 'shopify_metaobject_id may already exist on platforms'}`);
    }

    try {
      await sql`
        ALTER TABLE sellers
        ADD COLUMN IF NOT EXISTS shopify_metaobject_id VARCHAR(100)
      `;
      results.push('Added shopify_metaobject_id column to sellers');
    } catch (err) {
      results.push(`Note: ${err instanceof Error ? err.message : 'shopify_metaobject_id may already exist on sellers'}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Resource consolidation migration completed',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Failed to run migration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/migrate/resource-consolidation
 * Check migration status
 */
export async function GET() {
  try {
    const status: Record<string, unknown> = {};

    // Check if sellers has new columns
    const sellerColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sellers'
      AND column_name IN ('platform_id', 'linked_seller_id', 'shopify_metaobject_id')
    `;
    const sellerCols = sellerColumns.rows.map(r => r.column_name);
    status.sellerPlatformIdExists = sellerCols.includes('platform_id');
    status.sellerLinkedSellerIdExists = sellerCols.includes('linked_seller_id');
    status.sellerShopifyIdExists = sellerCols.includes('shopify_metaobject_id');

    // Check if platforms has shopify_metaobject_id
    const platformColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'platforms'
      AND column_name = 'shopify_metaobject_id'
    `;
    status.platformShopifyIdExists = platformColumns.rows.length > 0;

    // Count generic platforms
    const genericPlatforms = await sql`
      SELECT COUNT(*) as count FROM platforms
      WHERE name IN ('Estate Sale (Generic)', 'Flea Market (Unknown)', 'Antique Store (Unknown)', 'Garage Sale')
    `;
    status.genericPlatformCount = parseInt(genericPlatforms.rows[0].count);

    // Count individual sellers (migrated from platform_identities)
    const individualSellers = await sql`
      SELECT COUNT(*) as count FROM sellers WHERE type = 'individual'
    `;
    status.individualSellerCount = parseInt(individualSellers.rows[0].count);

    // Determine if migration is complete
    const migrationComplete =
      status.sellerPlatformIdExists &&
      status.sellerLinkedSellerIdExists &&
      status.sellerShopifyIdExists &&
      status.platformShopifyIdExists &&
      status.genericPlatformCount >= 4;

    return NextResponse.json({
      status,
      migrationComplete,
      details: migrationComplete
        ? `Complete: ${status.genericPlatformCount} generic platforms, ${status.individualSellerCount} individual sellers`
        : 'Migration needed',
    });
  } catch (error) {
    console.error('Migration status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check migration status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
