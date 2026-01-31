-- =====================
-- Printing Technique IDs Migration
-- Adds support for multiple printing techniques per poster
-- =====================

-- Add printing_technique_ids column to posters table
-- Stores array of FK references to media_types table
ALTER TABLE posters ADD COLUMN IF NOT EXISTS printing_technique_ids JSONB DEFAULT '[]';

-- Create GIN index for efficient querying
CREATE INDEX IF NOT EXISTS idx_posters_printing_technique_ids ON posters USING GIN (printing_technique_ids);
