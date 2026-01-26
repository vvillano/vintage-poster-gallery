-- Migration: Add product_type field for product classification
-- Run this in your Neon Postgres database

-- Add product_type column
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS product_type TEXT;

-- Add index for filtering by product type
CREATE INDEX IF NOT EXISTS idx_posters_product_type ON posters(product_type);

-- Add helpful comment
COMMENT ON COLUMN posters.product_type IS 'Product classification from Shopify categories: Poster, Window Card, Product Label, Illustration, Antique Print, Cover Art, Vintage Ad, Map, Postcard, Trade Card, Victorian Trade Card, Magazine/Book, Merchandise, Ephemera';
