-- Migration: Add enhanced artist verification fields
-- Run this in your database to add new fields for rigorous artist identification

-- Add artist confidence score (0-100 percentage)
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS artist_confidence_score INTEGER;

-- Add artist signature text (exact text visible on piece)
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS artist_signature_text TEXT;

-- Add artist verification data (JSON object with verification checklist)
ALTER TABLE posters
ADD COLUMN IF NOT EXISTS artist_verification JSONB;

-- Add helpful comments
COMMENT ON COLUMN posters.artist_confidence_score IS 'Confidence percentage 0-100 for artist attribution';
COMMENT ON COLUMN posters.artist_signature_text IS 'Exact text of signature as visible (e.g., "P. Verger")';
COMMENT ON COLUMN posters.artist_verification IS 'JSON verification checklist: signatureReadable, professionVerified, eraMatches, styleMatches, multipleArtistsWithName, verificationNotes';

-- Create index for filtering by confidence score
CREATE INDEX IF NOT EXISTS idx_posters_artist_confidence_score ON posters (artist_confidence_score);
