-- Push Queue & History Migration
-- Adds tables for the Shopify push queue system, push history (undo/audit), and user settings.

-- Push queue: per-field pending changes per poster
-- Each row represents a single field that has been changed locally and is waiting to be pushed to Shopify.
-- UNIQUE(poster_id, field_key) ensures only one queue entry per field per poster.
CREATE TABLE IF NOT EXISTS push_queue (
  id SERIAL PRIMARY KEY,
  poster_id INTEGER NOT NULL REFERENCES posters(id) ON DELETE CASCADE,
  field_key VARCHAR(50) NOT NULL,
  queued_at TIMESTAMP DEFAULT NOW(),
  auto_eligible BOOLEAN DEFAULT FALSE,
  UNIQUE(poster_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_push_queue_poster ON push_queue(poster_id);
CREATE INDEX IF NOT EXISTS idx_push_queue_pending ON push_queue(poster_id, field_key);

-- Push history: every push recorded for undo + audit trail
-- Stores previous and new values so we can revert (undo) any individual field push.
-- Undo is available until the next push to the same field.
CREATE TABLE IF NOT EXISTS push_history (
  id SERIAL PRIMARY KEY,
  poster_id INTEGER NOT NULL REFERENCES posters(id) ON DELETE CASCADE,
  field_key VARCHAR(50) NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  pushed_at TIMESTAMP DEFAULT NOW(),
  pushed_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_push_history_poster ON push_history(poster_id);
CREATE INDEX IF NOT EXISTS idx_push_history_poster_field ON push_history(poster_id, field_key);
CREATE INDEX IF NOT EXISTS idx_push_history_pushed_at ON push_history(pushed_at DESC);

-- User settings: auto-push preferences and other per-user configuration
-- Keyed by NextAuth session username (env-based credentials).
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  auto_push_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
