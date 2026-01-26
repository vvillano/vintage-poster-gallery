-- Migration: Fix column names from camelCase to snake_case
-- Run this in your Neon Postgres database

-- Drop the existing table (CAUTION: This will delete all data)
DROP TABLE IF EXISTS posters CASCADE;

-- Create the table with correct snake_case column names
CREATE TABLE posters (
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
  product_description TEXT,  -- Marketing-ready product description
  source_citations JSONB,  -- Array of source links with descriptions
  similar_products JSONB,  -- Array of similar products on other sites

  -- Analysis metadata
  analysis_completed BOOLEAN DEFAULT FALSE,
  analysis_date TIMESTAMP,
  raw_ai_response JSONB,

  -- User edits
  user_notes TEXT,
  last_modified TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_posters_upload_date ON posters(upload_date DESC);
CREATE INDEX idx_posters_analysis_completed ON posters(analysis_completed);
CREATE INDEX idx_posters_artist ON posters(artist);
CREATE INDEX idx_posters_uploaded_by ON posters(uploaded_by);
