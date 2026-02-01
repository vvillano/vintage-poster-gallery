import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/research-enhancements
 *
 * Creates tables and columns for research enhancements:
 * - platform_research_data: Research-specific data for platforms (credentials, URLs)
 * - private_sellers: Directory of actual people/businesses
 * - platform_identities: Platform usernames linked to sellers
 * - Poster columns: shopify_title, research_images
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // 1. Create platform_research_data table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS platform_research_data (
          id SERIAL PRIMARY KEY,
          platform_name VARCHAR(100) NOT NULL UNIQUE,
          url VARCHAR(500),
          username VARCHAR(255),
          password VARCHAR(255),
          is_research_site BOOLEAN DEFAULT false,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      results.push('Created platform_research_data table');
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        results.push('platform_research_data table already exists');
      } else {
        throw err;
      }
    }

    // 2. Create private_sellers table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS private_sellers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          seller_type VARCHAR(50) DEFAULT 'dealer',
          email VARCHAR(255),
          phone VARCHAR(50),
          url VARCHAR(500),
          username VARCHAR(255),
          password VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      results.push('Created private_sellers table');
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        results.push('private_sellers table already exists');
      } else {
        throw err;
      }
    }

    // 3. Create platform_identities table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS platform_identities (
          id SERIAL PRIMARY KEY,
          platform_name VARCHAR(100) NOT NULL,
          platform_username VARCHAR(255) NOT NULL,
          seller_id INT REFERENCES private_sellers(id) ON DELETE SET NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(platform_name, platform_username)
        )
      `;
      results.push('Created platform_identities table');
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        results.push('platform_identities table already exists');
      } else {
        throw err;
      }
    }

    // 4. Create indexes for efficient lookups
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_platform_research_data_name ON platform_research_data(platform_name)`;
      results.push('Created index on platform_research_data.platform_name');
    } catch (err) {
      results.push('Index on platform_research_data.platform_name may already exist');
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_private_sellers_name ON private_sellers(name)`;
      results.push('Created index on private_sellers.name');
    } catch (err) {
      results.push('Index on private_sellers.name may already exist');
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_platform_identities_platform ON platform_identities(platform_name)`;
      results.push('Created index on platform_identities.platform_name');
    } catch (err) {
      results.push('Index on platform_identities.platform_name may already exist');
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_platform_identities_seller ON platform_identities(seller_id)`;
      results.push('Created index on platform_identities.seller_id');
    } catch (err) {
      results.push('Index on platform_identities.seller_id may already exist');
    }

    // 5. Add shopify_title column to posters table
    try {
      await sql`ALTER TABLE posters ADD COLUMN IF NOT EXISTS shopify_title VARCHAR(500)`;
      results.push('Added shopify_title column to posters');
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        results.push('shopify_title column already exists');
      } else {
        throw err;
      }
    }

    // 6. Add research_images column to posters table (JSONB for array of research images)
    try {
      await sql`ALTER TABLE posters ADD COLUMN IF NOT EXISTS research_images JSONB`;
      results.push('Added research_images column to posters');
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        results.push('research_images column already exists');
      } else {
        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Research enhancements migration completed',
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
 * GET /api/migrate/research-enhancements
 *
 * Check migration status OR run migration if ?run=true
 * TEMPORARY: No auth for dev testing
 */
export async function GET(request: NextRequest) {
  try {
    // TEMPORARY: Skip auth for dev testing
    // const session = await getServerSession(authOptions);
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // If ?run=true, execute the migration
    const runMigration = request.nextUrl.searchParams.get('run') === 'true';

    if (runMigration) {
      const results: string[] = [];

      // 1. Create platform_research_data table
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS platform_research_data (
            id SERIAL PRIMARY KEY,
            platform_name VARCHAR(100) NOT NULL UNIQUE,
            url VARCHAR(500),
            username VARCHAR(255),
            password VARCHAR(255),
            is_research_site BOOLEAN DEFAULT false,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `;
        results.push('Created platform_research_data table');
      } catch (err) {
        if (err instanceof Error && err.message.includes('already exists')) {
          results.push('platform_research_data table already exists');
        } else {
          throw err;
        }
      }

      // 2. Create private_sellers table
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS private_sellers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            seller_type VARCHAR(50) DEFAULT 'dealer',
            email VARCHAR(255),
            phone VARCHAR(50),
            url VARCHAR(500),
            username VARCHAR(255),
            password VARCHAR(255),
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `;
        results.push('Created private_sellers table');
      } catch (err) {
        if (err instanceof Error && err.message.includes('already exists')) {
          results.push('private_sellers table already exists');
        } else {
          throw err;
        }
      }

      // 3. Create platform_identities table
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS platform_identities (
            id SERIAL PRIMARY KEY,
            platform_name VARCHAR(100) NOT NULL,
            platform_username VARCHAR(255) NOT NULL,
            seller_id INT REFERENCES private_sellers(id) ON DELETE SET NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(platform_name, platform_username)
          )
        `;
        results.push('Created platform_identities table');
      } catch (err) {
        if (err instanceof Error && err.message.includes('already exists')) {
          results.push('platform_identities table already exists');
        } else {
          throw err;
        }
      }

      // 4. Create indexes
      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_platform_research_data_name ON platform_research_data(platform_name)`;
        results.push('Created index on platform_research_data.platform_name');
      } catch (err) {
        results.push('Index on platform_research_data.platform_name may already exist');
      }

      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_private_sellers_name ON private_sellers(name)`;
        results.push('Created index on private_sellers.name');
      } catch (err) {
        results.push('Index on private_sellers.name may already exist');
      }

      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_platform_identities_platform ON platform_identities(platform_name)`;
        results.push('Created index on platform_identities.platform_name');
      } catch (err) {
        results.push('Index on platform_identities.platform_name may already exist');
      }

      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_platform_identities_seller ON platform_identities(seller_id)`;
        results.push('Created index on platform_identities.seller_id');
      } catch (err) {
        results.push('Index on platform_identities.seller_id may already exist');
      }

      // 5. Add shopify_title column
      try {
        await sql`ALTER TABLE posters ADD COLUMN IF NOT EXISTS shopify_title VARCHAR(500)`;
        results.push('Added shopify_title column to posters');
      } catch (err) {
        if (err instanceof Error && err.message.includes('already exists')) {
          results.push('shopify_title column already exists');
        } else {
          throw err;
        }
      }

      // 6. Add research_images column
      try {
        await sql`ALTER TABLE posters ADD COLUMN IF NOT EXISTS research_images JSONB`;
        results.push('Added research_images column to posters');
      } catch (err) {
        if (err instanceof Error && err.message.includes('already exists')) {
          results.push('research_images column already exists');
        } else {
          throw err;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Research enhancements migration completed',
        results,
      });
    }

    // Otherwise, just check status
    const status: Record<string, boolean> = {};

    // Check if tables exist
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('platform_research_data', 'private_sellers', 'platform_identities')
    `;

    status.platform_research_data = tables.rows.some(r => r.table_name === 'platform_research_data');
    status.private_sellers = tables.rows.some(r => r.table_name === 'private_sellers');
    status.platform_identities = tables.rows.some(r => r.table_name === 'platform_identities');

    // Check if poster columns exist
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'posters'
      AND column_name IN ('shopify_title', 'research_images')
    `;

    status.shopify_title_column = columns.rows.some(r => r.column_name === 'shopify_title');
    status.research_images_column = columns.rows.some(r => r.column_name === 'research_images');

    const allComplete = Object.values(status).every(v => v);

    return NextResponse.json({
      migrated: allComplete,
      status,
    });
  } catch (error) {
    console.error('Migration status check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check migration status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
