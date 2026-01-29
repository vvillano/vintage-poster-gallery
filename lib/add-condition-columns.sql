-- Condition Columns Migration
-- Run this in Vercel Postgres console

-- Add condition fields to posters table (for Shopify metafield data)
ALTER TABLE posters ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE posters ADD COLUMN IF NOT EXISTS condition_details TEXT;
