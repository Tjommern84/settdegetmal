-- Store last search preferences per user for simple recommendations.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_location_label text,
  last_lat double precision,
  last_lon double precision,
  last_goal text,
  last_service_type text,
  last_budget text,
  last_venue text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_owner_select
  ON user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY user_preferences_owner_upsert
  ON user_preferences
  FOR INSERT, UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
