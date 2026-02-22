-- Brønnøysundregisteret entities table
-- This table stores business entities from the Norwegian Business Registry

CREATE TABLE IF NOT EXISTS brreg_entities (
  -- Primary identification
  orgnr VARCHAR(9) PRIMARY KEY,
  navn TEXT NOT NULL,
  organisasjonsform_kode VARCHAR(10),
  organisasjonsform_beskrivelse TEXT,

  -- Business codes (NACE)
  naeringskode1_kode VARCHAR(10),
  naeringskode1_beskrivelse TEXT,
  naeringskode2_kode VARCHAR(10),
  naeringskode2_beskrivelse TEXT,
  naeringskode3_kode VARCHAR(10),
  naeringskode3_beskrivelse TEXT,

  -- Contact information
  forretningsadresse_adresse TEXT[],
  forretningsadresse_postnummer VARCHAR(4),
  forretningsadresse_poststed TEXT,
  forretningsadresse_kommune TEXT,
  forretningsadresse_kommunenummer VARCHAR(4),
  forretningsadresse_land TEXT,
  forretningsadresse_landkode VARCHAR(2),

  postadresse_adresse TEXT[],
  postadresse_postnummer VARCHAR(4),
  postadresse_poststed TEXT,
  postadresse_kommune TEXT,
  postadresse_kommunenummer VARCHAR(4),
  postadresse_land TEXT,
  postadresse_landkode VARCHAR(2),

  hjemmeside TEXT,

  -- Geography (for PostGIS)
  location GEOGRAPHY(Point, 4326),

  -- Status flags
  registrert_i_enhetsregisteret BOOLEAN DEFAULT FALSE,
  registrert_i_foretaksregisteret BOOLEAN DEFAULT FALSE,
  registrert_i_mvaregisteret BOOLEAN DEFAULT FALSE,
  registrert_i_frivillighetsregisteret BOOLEAN DEFAULT FALSE,
  registrert_i_stiftelsesregisteret BOOLEAN DEFAULT FALSE,

  antall_ansatte INTEGER,
  konkurs BOOLEAN DEFAULT FALSE,
  under_avvikling BOOLEAN DEFAULT FALSE,
  under_tvangsavvikling_eller_tvangsopplosning BOOLEAN DEFAULT FALSE,

  -- Dates
  stiftelsesdato DATE,
  registreringsdato_enhetsregisteret DATE,
  registreringsdato_foretaksregisteret DATE,
  registreringsdato_mvaregisteret DATE,

  -- Metadata
  imported_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  raw_data JSONB, -- Store original JSON for reference

  -- Our categorization
  category VARCHAR(50),
  subcategories TEXT[],
  tags TEXT[],

  -- Quality scores
  quality_score INTEGER DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  relevance_score INTEGER CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 100)),
  verified BOOLEAN DEFAULT FALSE,
  verification_notes TEXT,
  verified_at TIMESTAMP,
  verified_by VARCHAR(255)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_brreg_entities_naeringskode1 ON brreg_entities(naeringskode1_kode);
CREATE INDEX IF NOT EXISTS idx_brreg_entities_naeringskode2 ON brreg_entities(naeringskode2_kode);
CREATE INDEX IF NOT EXISTS idx_brreg_entities_naeringskode3 ON brreg_entities(naeringskode3_kode);
CREATE INDEX IF NOT EXISTS idx_brreg_entities_kommune ON brreg_entities(forretningsadresse_kommunenummer);
CREATE INDEX IF NOT EXISTS idx_brreg_entities_category ON brreg_entities(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brreg_entities_location ON brreg_entities USING GIST (location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brreg_entities_verified ON brreg_entities(verified) WHERE verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_brreg_entities_relevance ON brreg_entities(relevance_score) WHERE relevance_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brreg_entities_imported ON brreg_entities(imported_at);

-- Full text search on name
CREATE INDEX IF NOT EXISTS idx_brreg_entities_name_trgm ON brreg_entities USING GIN (navn gin_trgm_ops);

-- Subunits (branches, departments)
CREATE TABLE IF NOT EXISTS brreg_subunits (
  orgnr VARCHAR(9) PRIMARY KEY,
  overordnet_enhet VARCHAR(9) REFERENCES brreg_entities(orgnr) ON DELETE CASCADE,
  navn TEXT NOT NULL,

  naeringskode_kode VARCHAR(10),
  naeringskode_beskrivelse TEXT,

  beliggenhetsadresse_adresse TEXT[],
  beliggenhetsadresse_postnummer VARCHAR(4),
  beliggenhetsadresse_poststed TEXT,
  beliggenhetsadresse_kommune TEXT,
  beliggenhetsadresse_kommunenummer VARCHAR(4),
  beliggenhetsadresse_land TEXT,
  beliggenhetsadresse_landkode VARCHAR(2),

  location GEOGRAPHY(Point, 4326),
  antall_ansatte INTEGER,

  imported_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  raw_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_brreg_subunits_parent ON brreg_subunits(overordnet_enhet);
CREATE INDEX IF NOT EXISTS idx_brreg_subunits_location ON brreg_subunits USING GIST (location) WHERE location IS NOT NULL;

-- Import log to track bulk imports
CREATE TABLE IF NOT EXISTS brreg_import_log (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(20) CHECK (status IN ('running', 'completed', 'failed')),

  total_downloaded INTEGER,
  total_filtered INTEGER,
  total_imported INTEGER,
  total_updated INTEGER,
  total_errors INTEGER,

  nace_codes TEXT[],
  error_message TEXT,
  metadata JSONB
);

-- Enrichment queue for tracking which entities need enrichment
CREATE TABLE IF NOT EXISTS brreg_enrichment_queue (
  orgnr VARCHAR(9) PRIMARY KEY REFERENCES brreg_entities(orgnr) ON DELETE CASCADE,
  priority INTEGER DEFAULT 50,

  needs_geocoding BOOLEAN DEFAULT FALSE,
  geocoding_attempted_at TIMESTAMP,
  geocoding_attempts INTEGER DEFAULT 0,

  needs_website_scrape BOOLEAN DEFAULT FALSE,
  website_scraped_at TIMESTAMP,

  needs_google_places BOOLEAN DEFAULT FALSE,
  google_places_attempted_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority ON brreg_enrichment_queue(priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_geocoding ON brreg_enrichment_queue(needs_geocoding) WHERE needs_geocoding = TRUE;
