-- Shopify Integration Migration
-- Run this in Vercel Postgres console

-- Add Shopify fields to posters table
ALTER TABLE posters ADD COLUMN IF NOT EXISTS shopify_product_id TEXT;
ALTER TABLE posters ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE posters ADD COLUMN IF NOT EXISTS shopify_status TEXT;
ALTER TABLE posters ADD COLUMN IF NOT EXISTS shopify_synced_at TIMESTAMP;
ALTER TABLE posters ADD COLUMN IF NOT EXISTS shopify_data JSONB;

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_posters_shopify_id ON posters(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_posters_sku ON posters(sku);

-- Shopify configuration table (stores API credentials)
CREATE TABLE IF NOT EXISTS shopify_config (
  id SERIAL PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  access_token TEXT NOT NULL,
  api_version TEXT DEFAULT '2024-01',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Only allow one config row (single store setup)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopify_config_singleton ON shopify_config ((true));
