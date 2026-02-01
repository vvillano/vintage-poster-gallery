import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * GET /api/migrate/platform-consolidation
 *
 * Consolidate platform_research_data and research_sites into unified platforms table.
 * Run with ?run=true to execute migration.
 */
export async function GET(request: NextRequest) {
  try {
    const runMigration = request.nextUrl.searchParams.get('run') === 'true';

    if (runMigration) {
      const results: string[] = [];

      // 1. Create unified platforms table
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS platforms (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            url VARCHAR(500),
            search_url_template VARCHAR(500),
            is_acquisition_platform BOOLEAN DEFAULT false,
            is_research_site BOOLEAN DEFAULT false,
            requires_subscription BOOLEAN DEFAULT false,
            username VARCHAR(255),
            password VARCHAR(255),
            display_order INTEGER DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `;
        results.push('Created platforms table');
      } catch (err) {
        if (err instanceof Error && err.message.includes('already exists')) {
          results.push('platforms table already exists');
        } else {
          throw err;
        }
      }

      // 2. Create indexes
      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_platforms_name ON platforms(name)`;
        results.push('Created index on platforms.name');
      } catch {
        results.push('Index on platforms.name may already exist');
      }

      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_platforms_display_order ON platforms(display_order)`;
        results.push('Created index on platforms.display_order');
      } catch {
        results.push('Index on platforms.display_order may already exist');
      }

      // 3. Migrate data from platform_research_data (if exists)
      try {
        const platformData = await sql`
          SELECT * FROM platform_research_data
        `;

        for (const row of platformData.rows) {
          // Check if already exists in platforms
          const existing = await sql`
            SELECT id FROM platforms WHERE LOWER(name) = LOWER(${row.platform_name})
          `;

          if (existing.rows.length === 0) {
            await sql`
              INSERT INTO platforms (name, url, is_acquisition_platform, is_research_site, username, password, notes, created_at, updated_at)
              VALUES (${row.platform_name}, ${row.url}, true, ${row.is_research_site || false}, ${row.username}, ${row.password}, ${row.notes}, ${row.created_at}, ${row.updated_at})
            `;
            results.push(`Migrated platform_research_data: ${row.platform_name}`);
          } else {
            // Update existing to add acquisition flag
            await sql`
              UPDATE platforms
              SET is_acquisition_platform = true,
                  username = COALESCE(${row.username}, username),
                  password = COALESCE(${row.password}, password),
                  url = COALESCE(${row.url}, url),
                  notes = COALESCE(${row.notes}, notes)
              WHERE LOWER(name) = LOWER(${row.platform_name})
            `;
            results.push(`Merged platform_research_data: ${row.platform_name}`);
          }
        }
        results.push(`Processed ${platformData.rows.length} records from platform_research_data`);
      } catch (err) {
        if (err instanceof Error && err.message.includes('does not exist')) {
          results.push('platform_research_data table does not exist - skipping');
        } else {
          results.push(`Error migrating platform_research_data: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }

      // 4. Migrate data from research_sites (if exists)
      try {
        const researchSites = await sql`
          SELECT * FROM research_sites
        `;

        for (const row of researchSites.rows) {
          // Check if already exists in platforms
          const existing = await sql`
            SELECT id FROM platforms WHERE LOWER(name) = LOWER(${row.name})
          `;

          if (existing.rows.length === 0) {
            await sql`
              INSERT INTO platforms (name, search_url_template, is_research_site, requires_subscription, username, password, display_order, created_at)
              VALUES (${row.name}, ${row.url_template}, true, ${row.requires_subscription || false}, ${row.username}, ${row.password}, ${row.display_order || 0}, ${row.created_at})
            `;
            results.push(`Migrated research_sites: ${row.name}`);
          } else {
            // Update existing to add research site flag and template
            await sql`
              UPDATE platforms
              SET is_research_site = true,
                  search_url_template = COALESCE(${row.url_template}, search_url_template),
                  requires_subscription = COALESCE(${row.requires_subscription}, requires_subscription),
                  display_order = COALESCE(${row.display_order}, display_order),
                  username = COALESCE(username, ${row.username}),
                  password = COALESCE(password, ${row.password})
              WHERE LOWER(name) = LOWER(${row.name})
            `;
            results.push(`Merged research_sites: ${row.name}`);
          }
        }
        results.push(`Processed ${researchSites.rows.length} records from research_sites`);
      } catch (err) {
        if (err instanceof Error && err.message.includes('does not exist')) {
          results.push('research_sites table does not exist - skipping');
        } else {
          results.push(`Error migrating research_sites: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Platform consolidation migration completed',
        results,
      });
    }

    // Check status
    const status: Record<string, unknown> = {};

    // Check if platforms table exists
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('platforms', 'platform_research_data', 'research_sites')
    `;

    const existingTables = tablesResult.rows.map(r => r.table_name);
    status.platformsTableExists = existingTables.includes('platforms');
    status.oldPlatformResearchDataExists = existingTables.includes('platform_research_data');
    status.oldResearchSitesExists = existingTables.includes('research_sites');

    // Count records if tables exist
    if (status.platformsTableExists) {
      const countResult = await sql`SELECT COUNT(*) as count FROM platforms`;
      status.platformsCount = countResult.rows[0].count;
    }

    if (status.oldPlatformResearchDataExists) {
      const countResult = await sql`SELECT COUNT(*) as count FROM platform_research_data`;
      status.oldPlatformResearchDataCount = countResult.rows[0].count;
    }

    if (status.oldResearchSitesExists) {
      const countResult = await sql`SELECT COUNT(*) as count FROM research_sites`;
      status.oldResearchSitesCount = countResult.rows[0].count;
    }

    return NextResponse.json({
      status,
      migrationNeeded: !status.platformsTableExists ||
        (status.oldPlatformResearchDataExists && Number(status.oldPlatformResearchDataCount) > 0) ||
        (status.oldResearchSitesExists && Number(status.oldResearchSitesCount) > 0),
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
