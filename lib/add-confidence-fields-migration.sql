-- Migration: Add artist/date confidence fields and printer field
-- Run this in your database to add new fields without dropping existing data

-- Add artist confidence fields
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS artist_confidence VARCHAR(20),
ADD COLUMN IF NOT EXISTS artist_source TEXT;

-- Add date confidence fields
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS date_confidence VARCHAR(20),
ADD COLUMN IF NOT EXISTS date_source TEXT;

-- Add printer/publisher field
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS printer TEXT;

-- Add helpful comments
COMMENT ON COLUMN posters.artist_confidence IS 'Confidence level: confirmed, likely, uncertain, unknown';
COMMENT ON COLUMN posters.artist_source IS 'Where the artist name was found (e.g., signed lower right, printed, research)';
COMMENT ON COLUMN posters.date_confidence IS 'Confidence level: confirmed, likely, uncertain, unknown';
COMMENT ON COLUMN posters.date_source IS 'Where the date was found (e.g., printed on piece, research, style analysis)';
COMMENT ON COLUMN posters.printer IS 'Printer/publisher if visible or known';
