-- ============================================
-- BRREG import: legg til kolonner på services
-- Run AFTER 00_schema.sql
-- ============================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS orgnr TEXT UNIQUE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS address TEXT;

-- Index for oppslag på orgnr (unngå duplikater ved re-import)
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_orgnr ON services (orgnr) WHERE orgnr IS NOT NULL;
