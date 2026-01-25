-- Vintage Poster Gallery Database Schema
-- Run this SQL in your Vercel Postgres (or Neon) database

CREATE TABLE IF NOT EXISTS posters (
  id SERIAL PRIMARY KEY,

  -- Image storage info
  image_url TEXT NOT NULL,
  image_blob_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,

  -- Upload metadata
  upload_date TIMESTAMP DEFAULT NOW(),
  uploaded_by TEXT NOT NULL,

  -- Initial information provided at upload (optional)
  initial_information TEXT,

  -- AI Analysis Results
  artist TEXT,
  title TEXT,
  estimated_date TEXT,
  dimensions_estimate TEXT,
  historical_context TEXT,
  significance TEXT,
  printing_technique TEXT,
  rarity_analysis TEXT,
  value_insights TEXT,
  validation_notes TEXT,  -- AI notes on validating initial information

  -- Analysis metadata
  analysis_completed BOOLEAN DEFAULT FALSE,
  analysis_date TIMESTAMP,
  raw_ai_response JSONB,

  -- User edits
  user_notes TEXT,
  last_modified TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posters_upload_date ON posters(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_posters_analysis_completed ON posters(analysis_completed);
CREATE INDEX IF NOT EXISTS idx_posters_artist ON posters(artist);
CREATE INDEX IF NOT EXISTS idx_posters_uploaded_by ON posters(uploaded_by);

-- Optional: Create a users table for authentication (if not using environment variables)
-- CREATE TABLE IF NOT EXISTS users (
--   id SERIAL PRIMARY KEY,
--   username TEXT UNIQUE NOT NULL,
--   password_hash TEXT NOT NULL,
--   created_at TIMESTAMP DEFAULT NOW()
-- );
