-- Migration: Add attribution_basis column for tracking how artist was identified
-- Run this in your Neon Postgres database

-- Add the attribution_basis column
ALTER TABLE posters ADD COLUMN IF NOT EXISTS attribution_basis TEXT;

-- Valid values: 'visible_signature', 'printed_credit', 'stylistic_analysis', 'external_knowledge', 'none'
-- This tracks whether artist attribution came from:
--   visible_signature: Clear signature visible on the piece
--   printed_credit: Artist name printed in text (not handwritten)
--   stylistic_analysis: Attribution based purely on recognizable artistic style
--   external_knowledge: Attribution based on art historical knowledge (should cite source)
--   none: Cannot determine artist from any source
