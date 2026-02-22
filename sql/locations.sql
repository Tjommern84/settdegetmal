CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  city text,
  country text,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  source text NOT NULL,
  created_at timestamp without time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE (label, lat, lon)
);

CREATE INDEX IF NOT EXISTS idx_locations_label ON locations (lower(label));
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations (lower(city));
CREATE INDEX IF NOT EXISTS idx_locations_lat_lon ON locations (lat, lon);
