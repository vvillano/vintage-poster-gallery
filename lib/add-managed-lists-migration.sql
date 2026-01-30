-- Migration: Add managed lists for syncing with external apps
-- Run this in Vercel Postgres or your database console

-- =====================
-- Media Types (Printing Techniques)
-- =====================
CREATE TABLE IF NOT EXISTS media_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with common printing techniques
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
ON CONFLICT (name) DO NOTHING;

-- =====================
-- Artists
-- =====================
CREATE TABLE IF NOT EXISTS artists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,           -- Canonical name: "Leonetto Cappiello"
  aliases TEXT[],                        -- Variations: ["Cappiello", "L. Cappiello"]
  nationality VARCHAR(100),              -- "Italian-French"
  birth_year INT,
  death_year INT,
  notes TEXT,                            -- Research notes about the artist
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for searching by name and aliases
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists (name);
CREATE INDEX IF NOT EXISTS idx_artists_name_lower ON artists (LOWER(name));

-- =====================
-- Internal Tags
-- =====================
CREATE TABLE IF NOT EXISTS internal_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6B7280',    -- Hex color for UI display
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with common internal tags
INSERT INTO internal_tags (name, color, display_order) VALUES
  ('INV 2024', '#3B82F6', 1),
  ('INV 2025', '#3B82F6', 2),
  ('INV 2026', '#3B82F6', 3),
  ('Needs Research', '#F59E0B', 10),
  ('Ready to List', '#10B981', 11),
  ('Featured', '#8B5CF6', 12),
  ('Consignment', '#EC4899', 13)
ON CONFLICT (name) DO NOTHING;

-- =====================
-- Source Platforms
-- =====================
CREATE TABLE IF NOT EXISTS source_platforms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  url_template VARCHAR(500),             -- Optional URL template for linking
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with common acquisition sources
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
ON CONFLICT (name) DO NOTHING;

-- =====================
-- Locations (Physical Storage)
-- =====================
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,                      -- Additional details about the location
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with example locations
INSERT INTO locations (name, display_order) VALUES
  ('Main Storage', 1),
  ('Gallery Display', 2),
  ('Framing Queue', 3),
  ('Restoration', 4),
  ('Consignment - Out', 5)
ON CONFLICT (name) DO NOTHING;

-- =====================
-- Countries of Origin
-- =====================
CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(3),                       -- ISO 3166-1 alpha-2 or alpha-3
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with common poster origin countries
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
ON CONFLICT (name) DO NOTHING;

-- =====================
-- Add indexes for common queries
-- =====================
CREATE INDEX IF NOT EXISTS idx_media_types_order ON media_types (display_order);
CREATE INDEX IF NOT EXISTS idx_internal_tags_order ON internal_tags (display_order);
CREATE INDEX IF NOT EXISTS idx_source_platforms_order ON source_platforms (display_order);
CREATE INDEX IF NOT EXISTS idx_locations_order ON locations (display_order);
CREATE INDEX IF NOT EXISTS idx_countries_order ON countries (display_order);
