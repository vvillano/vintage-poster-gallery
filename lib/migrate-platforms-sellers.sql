-- Migration: Platforms and Sellers Refactoring
-- This migration implements the new acquisition tracking model:
-- - Platforms = WHERE you buy (marketplaces, venues, aggregators)
-- - Sellers = WHO you buy from (auction houses, dealers, individuals)

-- =====================================================
-- STEP 1: Update PLATFORMS table
-- Add canResearchPrices flag and ensure proper structure
-- =====================================================

-- Add can_research_prices column (replaces is_research_site for clarity)
ALTER TABLE platforms
ADD COLUMN IF NOT EXISTS can_research_prices BOOLEAN DEFAULT false;

-- Copy existing is_research_site values to can_research_prices
UPDATE platforms SET can_research_prices = is_research_site WHERE can_research_prices IS NULL;

-- Add search_sold_url_template for sold price research
ALTER TABLE platforms
ADD COLUMN IF NOT EXISTS search_sold_url_template VARCHAR(500);

-- Ensure platform_type column exists with proper values
-- Types: marketplace | venue | aggregator | direct
ALTER TABLE platforms
ALTER COLUMN platform_type SET DEFAULT 'marketplace';

-- =====================================================
-- STEP 2: Rename DEALERS table to SELLERS
-- Keep all existing fields, rename for clarity
-- =====================================================

-- First, check if dealers table exists and sellers doesn't
DO $$
BEGIN
  -- Only rename if dealers exists and sellers doesn't
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'dealers')
     AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'sellers') THEN
    ALTER TABLE dealers RENAME TO sellers;
  END IF;
END $$;

-- Add can_research_at column (clearer name for sellers)
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS can_research_at BOOLEAN DEFAULT false;

-- Copy existing can_research values to can_research_at
UPDATE sellers SET can_research_at = can_research WHERE can_research_at IS NULL;

-- Update seller types - remove platform types that should be in platforms table
-- Note: We'll migrate marketplace/aggregator records to platforms table separately

-- =====================================================
-- STEP 3: Update PLATFORM_IDENTITIES table
-- Add platform_id FK to link to platforms table
-- =====================================================

-- Add platform_id column
ALTER TABLE platform_identities
ADD COLUMN IF NOT EXISTS platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL;

-- Create index for platform_id
CREATE INDEX IF NOT EXISTS idx_platform_identities_platform_id ON platform_identities(platform_id);

-- Rename seller_id reference (if private_sellers was renamed to sellers)
-- The FK already points to private_sellers, we'll keep that for now

-- =====================================================
-- STEP 4: Update POSTERS table
-- Rename source_dealer_id to seller_id, add platform_identity field
-- =====================================================

-- Add seller_id column (will coexist with source_dealer_id during migration)
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL;

-- Copy existing source_dealer_id values to seller_id
UPDATE posters SET seller_id = source_dealer_id WHERE seller_id IS NULL AND source_dealer_id IS NOT NULL;

-- Rename acquisition_platform_id to platform_id for consistency
-- (keeping acquisition_platform_id for now to avoid breaking changes)

-- Add platform_identity text field for storing the seller's username on that platform
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS platform_identity VARCHAR(255);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_posters_seller_id ON posters(seller_id);
CREATE INDEX IF NOT EXISTS idx_posters_platform_identity ON posters(platform_identity);

-- =====================================================
-- STEP 5: Add "Direct" platform if it doesn't exist
-- This represents buying directly from a seller without a platform
-- =====================================================

INSERT INTO platforms (name, url, platform_type, is_acquisition_platform, is_research_site, can_research_prices, display_order)
SELECT 'Direct', NULL, 'direct', true, false, false, 999
WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE name = 'Direct');

-- =====================================================
-- STEP 6: Seed common platforms if they don't exist
-- =====================================================

-- eBay
INSERT INTO platforms (name, url, search_url_template, search_sold_url_template, platform_type, is_acquisition_platform, is_research_site, can_research_prices, display_order)
SELECT 'eBay', 'https://www.ebay.com', 'https://www.ebay.com/sch/i.html?_nkw={search}', 'https://www.ebay.com/sch/i.html?_nkw={search}&LH_Complete=1&LH_Sold=1&_sop=13', 'marketplace', true, true, true, 1
WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE name = 'eBay');

-- Live Auctioneers
INSERT INTO platforms (name, url, search_url_template, platform_type, is_acquisition_platform, is_research_site, can_research_prices, display_order)
SELECT 'Live Auctioneers', 'https://www.liveauctioneers.com', 'https://www.liveauctioneers.com/search/?keyword={search}&sort=-sale_date', 'marketplace', true, true, true, 2
WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE name = 'Live Auctioneers');

-- Invaluable
INSERT INTO platforms (name, url, search_url_template, platform_type, is_acquisition_platform, is_research_site, can_research_prices, requires_subscription, display_order)
SELECT 'Invaluable', 'https://www.invaluable.com', 'https://www.invaluable.com/search?query={search}', 'aggregator', true, true, true, true, 3
WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE name = 'Invaluable');

-- Worthpoint (research only, not acquisition)
INSERT INTO platforms (name, url, search_url_template, platform_type, is_acquisition_platform, is_research_site, can_research_prices, requires_subscription, display_order)
SELECT 'Worthpoint', 'https://www.worthpoint.com', 'https://www.worthpoint.com/search?query={search}', 'aggregator', false, true, true, true, 4
WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE name = 'Worthpoint');

-- Rose Bowl Flea Market (venue)
INSERT INTO platforms (name, url, platform_type, is_acquisition_platform, is_research_site, can_research_prices, display_order)
SELECT 'Rose Bowl Flea Market', 'https://rgcshows.com/rosebowl/', 'venue', true, false, false, 100
WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE name = 'Rose Bowl Flea Market');

-- Arcadia Paper Show (venue)
INSERT INTO platforms (name, platform_type, is_acquisition_platform, is_research_site, can_research_prices, display_order)
SELECT 'Arcadia Paper Show', 'venue', true, false, false, 101
WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE name = 'Arcadia Paper Show');

-- Estate Sale (generic venue)
INSERT INTO platforms (name, platform_type, is_acquisition_platform, is_research_site, can_research_prices, display_order)
SELECT 'Estate Sale', 'venue', true, false, false, 102
WHERE NOT EXISTS (SELECT 1 FROM platforms WHERE name = 'Estate Sale');

-- =====================================================
-- STEP 7: Create view for backward compatibility
-- =====================================================

-- Create a view that maps the old dealers table structure
CREATE OR REPLACE VIEW dealers AS
SELECT * FROM sellers;

-- =====================================================
-- STEP 8: Add comments for documentation
-- =====================================================

COMMENT ON TABLE platforms IS 'WHERE you buy - marketplaces, venues, aggregators';
COMMENT ON TABLE sellers IS 'WHO you buy from - auction houses, dealers, galleries, individuals';
COMMENT ON COLUMN platforms.can_research_prices IS 'If true, this platform can be used for price/valuation research';
COMMENT ON COLUMN sellers.can_research_at IS 'If true, this seller has searchable archives for identification/attribution research';
COMMENT ON COLUMN posters.platform_identity IS 'The seller username/ID on the acquisition platform';
