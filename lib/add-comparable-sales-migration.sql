-- Migration: Add comparable_sales column for tracking market research
-- Run this in your Vercel Postgres console

-- Add comparable_sales JSONB column to posters table
-- This will store an array of sale records with structure:
-- {
--   id: string (uuid),
--   date: string (ISO date),
--   price: number,
--   currency: string (default "USD"),
--   source: string (e.g., "Worthpoint", "Invaluable", "Heritage Auctions"),
--   condition: string (optional),
--   notes: string (optional),
--   url: string (optional - link to the sale),
--   createdAt: string (ISO timestamp)
-- }

ALTER TABLE posters
ADD COLUMN IF NOT EXISTS comparable_sales JSONB DEFAULT '[]'::jsonb;

-- Create index for faster queries on sales data
CREATE INDEX IF NOT EXISTS idx_posters_comparable_sales ON posters USING gin(comparable_sales);
