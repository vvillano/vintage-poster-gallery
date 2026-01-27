-- Migration: Add supplemental images field for multi-image analysis
-- Run this in your database to add the new field without dropping existing data

-- Add new column for supplemental images (array of image objects)
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS supplemental_images JSONB;

-- Add helpful comment
COMMENT ON COLUMN posters.supplemental_images IS 'Array of supplemental images for additional analysis context. Each image has url, blobId, fileName, description, and uploadDate.';
