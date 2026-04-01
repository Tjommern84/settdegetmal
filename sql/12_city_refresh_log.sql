-- ============================================
-- Migration 12: City refresh log for background data enrichment
-- Run in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS city_refresh_log (
  city              text        PRIMARY KEY,
  last_refreshed_at timestamptz NOT NULL DEFAULT now(),
  refresh_count     integer     NOT NULL DEFAULT 1
);

-- Allow anon to read (check cooldown) and service role to write
ALTER TABLE city_refresh_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read city_refresh_log"
  ON city_refresh_log FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role bypasses RLS by default, so no extra policy needed for writes.

COMMENT ON TABLE city_refresh_log IS
  'Tracks when each city was last refreshed via Serper.dev searches. '
  'Used to enforce 24-hour cooldown between refreshes per city.';
