-- ============================================
-- Many-to-many service types
-- Allows one service to belong to multiple categories.
-- Run AFTER 00_schema.sql
-- ============================================

CREATE TABLE IF NOT EXISTS service_types (
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'styrke','pt','yoga','gruppe','kondisjon','outdoor',
    'sport','mindbody','spesialisert','livsstil','teknologi'
  )),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (service_id, type)
);

CREATE INDEX IF NOT EXISTS idx_service_types_service_id ON service_types(service_id);
CREATE INDEX IF NOT EXISTS idx_service_types_type ON service_types(type);

-- Migrate existing single types from services.type
INSERT INTO service_types (service_id, type, is_primary)
SELECT id, type, true
FROM services
WHERE type IS NOT NULL
  AND type IN (
    'styrke','pt','yoga','gruppe','kondisjon','outdoor',
    'sport','mindbody','spesialisert','livsstil','teknologi'
  )
ON CONFLICT (service_id, type) DO NOTHING;
