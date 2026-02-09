import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * Run the platforms/sellers migration
 * This implements the new acquisition tracking model:
 * - Platforms = WHERE you buy (marketplaces, venues, aggregators)
 * - Sellers = WHO you buy from (auction houses, dealers, individuals)
 */
async function runPlatformsSellersMigration(): Promise<string[]> {
  const results: string[] = [];

  // =====================================================
  // STEP 1: Update PLATFORMS table
  // =====================================================

  // Add can_research_prices column
  try {
    await sql`
      ALTER TABLE platforms
      ADD COLUMN IF NOT EXISTS can_research_prices BOOLEAN DEFAULT false
    `;
    results.push('Added can_research_prices column to platforms');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'can_research_prices may already exist'}`);
  }

  // Copy is_research_site to can_research_prices
  try {
    await sql`
      UPDATE platforms
      SET can_research_prices = is_research_site
      WHERE can_research_prices = false AND is_research_site = true
    `;
    results.push('Copied is_research_site values to can_research_prices');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'Error copying values'}`);
  }

  // Add search_sold_url_template
  try {
    await sql`
      ALTER TABLE platforms
      ADD COLUMN IF NOT EXISTS search_sold_url_template VARCHAR(500)
    `;
    results.push('Added search_sold_url_template column to platforms');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'search_sold_url_template may already exist'}`);
  }

  // =====================================================
  // STEP 2: Rename DEALERS table to SELLERS
  // =====================================================

  // Check if dealers exists and sellers doesn't
  try {
    const tablesCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('dealers', 'sellers')
    `;
    const tableNames = tablesCheck.rows.map(r => r.table_name);

    if (tableNames.includes('dealers') && !tableNames.includes('sellers')) {
      await sql`ALTER TABLE dealers RENAME TO sellers`;
      results.push('Renamed dealers table to sellers');
    } else if (tableNames.includes('sellers')) {
      results.push('sellers table already exists');
    } else if (!tableNames.includes('dealers')) {
      results.push('dealers table does not exist - may need to create sellers table');
    }
  } catch (err) {
    results.push(`Note renaming table: ${err instanceof Error ? err.message : 'Unknown'}`);
  }

  // Add can_research_at column to sellers
  try {
    await sql`
      ALTER TABLE sellers
      ADD COLUMN IF NOT EXISTS can_research_at BOOLEAN DEFAULT false
    `;
    results.push('Added can_research_at column to sellers');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'can_research_at may already exist'}`);
  }

  // Copy can_research to can_research_at
  try {
    await sql`
      UPDATE sellers
      SET can_research_at = can_research
      WHERE can_research_at = false AND can_research = true
    `;
    results.push('Copied can_research values to can_research_at');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'Error copying values'}`);
  }

  // =====================================================
  // STEP 3: Update PLATFORM_IDENTITIES table
  // =====================================================

  // Add platform_id FK
  try {
    await sql`
      ALTER TABLE platform_identities
      ADD COLUMN IF NOT EXISTS platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL
    `;
    results.push('Added platform_id column to platform_identities');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'platform_id may already exist'}`);
  }

  // Create index for platform_id
  try {
    await sql`
      CREATE INDEX IF NOT EXISTS idx_platform_identities_platform_id
      ON platform_identities(platform_id)
    `;
    results.push('Created index on platform_identities.platform_id');
  } catch {
    results.push('Index on platform_identities.platform_id may already exist');
  }

  // Populate platform_id from platform_name where possible
  try {
    await sql`
      UPDATE platform_identities pi
      SET platform_id = p.id
      FROM platforms p
      WHERE LOWER(pi.platform_name) = LOWER(p.name)
      AND pi.platform_id IS NULL
    `;
    results.push('Linked platform_identities to platforms by name');
  } catch (err) {
    results.push(`Note linking platforms: ${err instanceof Error ? err.message : 'Unknown'}`);
  }

  // =====================================================
  // STEP 4: Update POSTERS table
  // =====================================================

  // Add seller_id column
  try {
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL
    `;
    results.push('Added seller_id column to posters');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'seller_id may already exist'}`);
  }

  // Copy source_dealer_id to seller_id
  try {
    await sql`
      UPDATE posters
      SET seller_id = source_dealer_id
      WHERE seller_id IS NULL AND source_dealer_id IS NOT NULL
    `;
    results.push('Copied source_dealer_id values to seller_id');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'Error copying values'}`);
  }

  // Add platform_identity text field
  try {
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS platform_identity VARCHAR(255)
    `;
    results.push('Added platform_identity column to posters');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'platform_identity may already exist'}`);
  }

  // Create indexes
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_posters_seller_id ON posters(seller_id)`;
    results.push('Created index on posters.seller_id');
  } catch {
    results.push('Index on posters.seller_id may already exist');
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_posters_platform_identity ON posters(platform_identity)`;
    results.push('Created index on posters.platform_identity');
  } catch {
    results.push('Index on posters.platform_identity may already exist');
  }

  // =====================================================
  // STEP 5: Add "Direct" platform
  // =====================================================

  try {
    const existing = await sql`SELECT id FROM platforms WHERE name = 'Direct'`;
    if (existing.rows.length === 0) {
      await sql`
        INSERT INTO platforms (name, url, platform_type, is_acquisition_platform, is_research_site, can_research_prices, display_order)
        VALUES ('Direct', NULL, 'direct', true, false, false, 999)
      `;
      results.push('Added "Direct" platform');
    } else {
      results.push('"Direct" platform already exists');
    }
  } catch (err) {
    results.push(`Note adding Direct: ${err instanceof Error ? err.message : 'Unknown'}`);
  }

  // =====================================================
  // STEP 6: Seed common platforms
  // =====================================================

  const platformsToSeed = [
    {
      name: 'eBay',
      url: 'https://www.ebay.com',
      searchUrlTemplate: 'https://www.ebay.com/sch/i.html?_nkw={search}',
      searchSoldUrlTemplate: 'https://www.ebay.com/sch/i.html?_nkw={search}&LH_Complete=1&LH_Sold=1&_sop=13',
      platformType: 'marketplace',
      isAcquisition: true,
      canResearchPrices: true,
      displayOrder: 1,
    },
    {
      name: 'Live Auctioneers',
      url: 'https://www.liveauctioneers.com',
      searchUrlTemplate: 'https://www.liveauctioneers.com/search/?keyword={search}&sort=-sale_date',
      searchSoldUrlTemplate: null,
      platformType: 'marketplace',
      isAcquisition: true,
      canResearchPrices: true,
      displayOrder: 2,
    },
    {
      name: 'Invaluable',
      url: 'https://www.invaluable.com',
      searchUrlTemplate: 'https://www.invaluable.com/search?query={search}',
      searchSoldUrlTemplate: null,
      platformType: 'aggregator',
      isAcquisition: true,
      canResearchPrices: true,
      requiresSubscription: true,
      displayOrder: 3,
    },
    {
      name: 'Worthpoint',
      url: 'https://www.worthpoint.com',
      searchUrlTemplate: 'https://www.worthpoint.com/search?query={search}',
      searchSoldUrlTemplate: null,
      platformType: 'aggregator',
      isAcquisition: false,
      canResearchPrices: true,
      requiresSubscription: true,
      displayOrder: 4,
    },
    {
      name: 'Rose Bowl Flea Market',
      url: 'https://rgcshows.com/rosebowl/',
      searchUrlTemplate: null,
      searchSoldUrlTemplate: null,
      platformType: 'venue',
      isAcquisition: true,
      canResearchPrices: false,
      displayOrder: 100,
    },
    {
      name: 'Arcadia Paper Show',
      url: null,
      searchUrlTemplate: null,
      searchSoldUrlTemplate: null,
      platformType: 'venue',
      isAcquisition: true,
      canResearchPrices: false,
      displayOrder: 101,
    },
    {
      name: 'Estate Sale',
      url: null,
      searchUrlTemplate: null,
      searchSoldUrlTemplate: null,
      platformType: 'venue',
      isAcquisition: true,
      canResearchPrices: false,
      displayOrder: 102,
    },
  ];

  for (const platform of platformsToSeed) {
    try {
      const existing = await sql`SELECT id FROM platforms WHERE name = ${platform.name}`;
      if (existing.rows.length === 0) {
        await sql`
          INSERT INTO platforms (
            name, url, search_url_template, search_sold_url_template,
            platform_type, is_acquisition_platform, is_research_site,
            can_research_prices, requires_subscription, display_order
          )
          VALUES (
            ${platform.name}, ${platform.url}, ${platform.searchUrlTemplate},
            ${platform.searchSoldUrlTemplate}, ${platform.platformType},
            ${platform.isAcquisition}, ${platform.canResearchPrices},
            ${platform.canResearchPrices}, ${platform.requiresSubscription || false},
            ${platform.displayOrder}
          )
        `;
        results.push(`Seeded platform: ${platform.name}`);
      } else {
        // Update existing platform with new fields
        await sql`
          UPDATE platforms
          SET can_research_prices = COALESCE(can_research_prices, ${platform.canResearchPrices}),
              search_sold_url_template = COALESCE(search_sold_url_template, ${platform.searchSoldUrlTemplate}),
              platform_type = COALESCE(platform_type, ${platform.platformType})
          WHERE name = ${platform.name}
        `;
        results.push(`Updated platform: ${platform.name}`);
      }
    } catch (err) {
      results.push(`Note seeding ${platform.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // =====================================================
  // STEP 7: Create backward compatibility view
  // =====================================================

  try {
    await sql`CREATE OR REPLACE VIEW dealers AS SELECT * FROM sellers`;
    results.push('Created dealers view for backward compatibility');
  } catch (err) {
    results.push(`Note creating view: ${err instanceof Error ? err.message : 'Unknown'}`);
  }

  return results;
}

/**
 * POST /api/migrate/platforms-sellers
 * Run the migration
 */
export async function POST() {
  try {
    const results = await runPlatformsSellersMigration();

    return NextResponse.json({
      success: true,
      message: 'Platforms/Sellers migration completed',
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
 * GET /api/migrate/platforms-sellers
 * Check status or run with ?run=true
 */
export async function GET(request: NextRequest) {
  try {
    const runMigration = request.nextUrl.searchParams.get('run') === 'true';

    if (runMigration) {
      const results = await runPlatformsSellersMigration();

      return NextResponse.json({
        success: true,
        message: 'Platforms/Sellers migration completed',
        results,
      });
    }

    // Check status
    const status: Record<string, unknown> = {};

    // Check which tables exist
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('platforms', 'dealers', 'sellers', 'platform_identities', 'posters')
    `;

    const existingTables = tablesResult.rows.map(r => r.table_name);
    status.platformsTableExists = existingTables.includes('platforms');
    status.dealersTableExists = existingTables.includes('dealers');
    status.sellersTableExists = existingTables.includes('sellers');

    // Check for new columns
    if (status.platformsTableExists) {
      const columnsResult = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'platforms'
        AND column_name IN ('can_research_prices', 'search_sold_url_template')
      `;
      const columns = columnsResult.rows.map(r => r.column_name);
      status.canResearchPricesExists = columns.includes('can_research_prices');
      status.searchSoldUrlTemplateExists = columns.includes('search_sold_url_template');
    }

    if (status.sellersTableExists || status.dealersTableExists) {
      const tableName = status.sellersTableExists ? 'sellers' : 'dealers';
      const columnsResult = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        AND column_name = 'can_research_at'
      `;
      status.canResearchAtExists = columnsResult.rows.length > 0;
    }

    // Check posters table columns
    const postersColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'posters'
      AND column_name IN ('seller_id', 'platform_identity')
    `;
    const posterCols = postersColumns.rows.map(r => r.column_name);
    status.posterSellerIdExists = posterCols.includes('seller_id');
    status.posterPlatformIdentityExists = posterCols.includes('platform_identity');

    // Determine if migration is needed
    const migrationNeeded =
      !status.sellersTableExists ||
      !status.canResearchPricesExists ||
      !status.canResearchAtExists ||
      !status.posterSellerIdExists ||
      !status.posterPlatformIdentityExists;

    return NextResponse.json({
      status,
      migrationNeeded,
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
