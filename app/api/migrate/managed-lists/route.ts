import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/managed-lists
 * Run the managed lists migration
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Media Types
    await sql`
      CREATE TABLE IF NOT EXISTS media_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Created media_types table');

    // Seed media types
    await sql`
      INSERT INTO media_types (name, display_order) VALUES
        ('Chromolithograph', 1),
        ('Copper Engraving', 2),
        ('Hand Colored', 3),
        ('Linen Backed', 4),
        ('Lithograph', 5),
        ('Offset Lithograph', 6),
        ('Screen Print', 7),
        ('Steel Engraving', 8),
        ('Stone Lithograph', 9),
        ('Woodcut', 10),
        ('Etching', 11),
        ('Pochoir', 12),
        ('Photolithograph', 13)
      ON CONFLICT (name) DO NOTHING
    `;
    results.push('Seeded media_types');

    // Artists
    await sql`
      CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        aliases TEXT[],
        nationality VARCHAR(100),
        birth_year INT,
        death_year INT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Created artists table');

    // Artists indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_artists_name ON artists (name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_artists_name_lower ON artists (LOWER(name))`;
    results.push('Created artists indexes');

    // Internal Tags
    await sql`
      CREATE TABLE IF NOT EXISTS internal_tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        color VARCHAR(7) DEFAULT '#6B7280',
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Created internal_tags table');

    // Seed internal tags
    await sql`
      INSERT INTO internal_tags (name, color, display_order) VALUES
        ('INV 2024', '#3B82F6', 1),
        ('INV 2025', '#3B82F6', 2),
        ('INV 2026', '#3B82F6', 3),
        ('Needs Research', '#F59E0B', 10),
        ('Ready to List', '#10B981', 11),
        ('Featured', '#8B5CF6', 12),
        ('Consignment', '#EC4899', 13)
      ON CONFLICT (name) DO NOTHING
    `;
    results.push('Seeded internal_tags');

    // Source Platforms
    await sql`
      CREATE TABLE IF NOT EXISTS source_platforms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        url_template VARCHAR(500),
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Created source_platforms table');

    // Seed source platforms
    await sql`
      INSERT INTO source_platforms (name, display_order) VALUES
        ('eBay', 1),
        ('Heritage Auctions', 2),
        ('Invaluable', 3),
        ('LiveAuctioneers', 4),
        ('Poster Auctions International', 5),
        ('Swann Galleries', 6),
        ('Rennert Gallery', 7),
        ('Private Seller', 8),
        ('Estate Sale', 9),
        ('Antique Show', 10),
        ('Auction (Other)', 11)
      ON CONFLICT (name) DO NOTHING
    `;
    results.push('Seeded source_platforms');

    // Locations
    await sql`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Created locations table');

    // Seed locations
    await sql`
      INSERT INTO locations (name, display_order) VALUES
        ('Main Storage', 1),
        ('Gallery Display', 2),
        ('Framing Queue', 3),
        ('Restoration', 4),
        ('Consignment - Out', 5)
      ON CONFLICT (name) DO NOTHING
    `;
    results.push('Seeded locations');

    // Countries
    await sql`
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(3),
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Created countries table');

    // Seed countries
    await sql`
      INSERT INTO countries (name, code, display_order) VALUES
        ('France', 'FR', 1),
        ('United States', 'US', 2),
        ('Italy', 'IT', 3),
        ('Germany', 'DE', 4),
        ('United Kingdom', 'GB', 5),
        ('Belgium', 'BE', 6),
        ('Netherlands', 'NL', 7),
        ('Switzerland', 'CH', 8),
        ('Spain', 'ES', 9),
        ('Austria', 'AT', 10),
        ('Poland', 'PL', 11),
        ('Russia', 'RU', 12),
        ('Japan', 'JP', 13),
        ('Czechoslovakia', 'CS', 14),
        ('Hungary', 'HU', 15)
      ON CONFLICT (name) DO NOTHING
    `;
    results.push('Seeded countries');

    // Create indexes for ordering
    await sql`CREATE INDEX IF NOT EXISTS idx_media_types_order ON media_types (display_order)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_internal_tags_order ON internal_tags (display_order)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_source_platforms_order ON source_platforms (display_order)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_locations_order ON locations (display_order)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_countries_order ON countries (display_order)`;
    results.push('Created ordering indexes');

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
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
