-- ============================================
-- Scraped website data: legg til kolonner på services
-- Run AFTER 04_brreg_columns.sql
-- ============================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS email TEXT;
