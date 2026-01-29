-- Shopify OAuth Migration
-- Run this in Vercel Postgres console to add OAuth support

-- Add OAuth credential columns to shopify_config table
ALTER TABLE shopify_config ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE shopify_config ADD COLUMN IF NOT EXISTS client_secret TEXT;

-- Note: The existing access_token column will now store the OAuth-obtained token
-- instead of a direct Admin API token
