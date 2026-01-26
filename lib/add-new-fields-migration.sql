-- Migration: Add product description, source citations, and similar products fields
-- Run this in your database to add new fields without dropping existing data

-- Add new columns
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS product_description TEXT,
ADD COLUMN IF NOT EXISTS source_citations JSONB,
ADD COLUMN IF NOT EXISTS similar_products JSONB;

-- Add helpful comments
COMMENT ON COLUMN posters.product_description IS 'Marketing-ready product description for website';
COMMENT ON COLUMN posters.source_citations IS 'Array of source links with descriptions for fact-checking';
COMMENT ON COLUMN posters.similar_products IS 'Array of similar products found on other sites (eBay, galleries, etc.)';
