# Strategi for Database-bygging: Brønnøysundregisteret

## Mål
Bygge en komplett database over alle helse- og treningsrelaterte virksomheter i Norge, inkludert:
- Treningssentere
- Personlige trenere (enkeltpersonforetak)
- Kostholdsveiledere
- Instruktører
- Rehabiliteringssentere
- Yoga/pilates-studioer
- Gruppetrening
- Utendørs treningsaktiviteter

---

## Fase 1: NACE-kode Research og Mapping

### Relevante næringskoder (NACE)

#### Direkte treningsrelatert:
- **93.130** - Treningssentre og gymsaler
- **93.199** - Andre sportsaktiviteter ikke nevnt annet sted
- **93.110** - Drift av idrettsanlegg
- **96.040** - Virksomhet tilknyttet personlig velvære (kan inkludere wellness, spa med trening)

#### Helse og fysioterapi:
- **86.901** - Fysioterapivirksomhet
- **86.909** - Annen helsetjeneste (kan inkludere personlige trenere med helsefokus)
- **86.220** - Allmennlegetjenester
- **86.903** - Kiropraktikk
- **86.904** - Psykologtjenester (mental helse relatert til trening)

#### Ernæring:
- **86.909** - Annen helsetjeneste (kan inkludere ernæringsfysiologer)
- **96.099** - Annen personlig tjenesteyting (kan inkludere kostholdsveiledere)

#### Outdoor og alternative:
- **93.199** - Andre sportsaktiviteter (yoga, pilates, klatring)
- **55.209** - Andre overnattingssteder (kan inkludere treningsleire)
- **93.290** - Andre fritids- og fornøyelsesaktiviteter

### Strategi for å finne alle relevante koder:
1. **Manuell gjennomgang**: Se gjennom NACE-hierarkiet for kategori 93 (Sport, fritid), 86 (Helse), 96 (Personlig service)
2. **Prøve-søk**: Hent ut enheter for hver kode og manuelt verifisere relevans
3. **Tekstsøk**: Søk på nøkkelord i navnefeltet ("trening", "fitness", "gym", "yoga", "pilates", "pt", "personlig trener")
4. **Kryssreferanse**: Bruke eksisterende lister (treningssentre.no, holdbar.no, etc.) for å verifisere at vi fanger alle

---

## Fase 2: Data-innhenting

### Strategi A: Bulk Download (Anbefalt for første import)

**Fordeler:**
- Raskere enn API-kall
- Ingen rate limit-bekymringer
- Komplett datasett på én gang

**Prosess:**
1. **Last ned nattlig oppdatering** (kl. 05:00):
   - JSON format: `/api/enheter/lastned`
   - Størrelse: Estimert 50-100 MB komprimert
2. **Filtrer lokalt på NACE-koder**
3. **Lagre i staging-database**
4. **Verifiser og clean data**
5. **Importer til produksjonsdatabase**

**Implementasjon:**
```typescript
// Eksempel struktur (IKKE KOD)
type BulkImportProcess = {
  1. download: () => downloadGzipFile();
  2. decompress: () => unzipToJSON();
  3. filter: () => filterByNaceCodes(relevantCodes);
  4. validate: () => validateAndCleanData();
  5. stage: () => insertIntoStaging();
  6. verify: () => manualVerification();
  7. promote: () => moveToProduction();
}
```

### Strategi B: Inkrementell API-søk (For vedlikehold)

**Prosess:**
1. **Daglig kjøring** (API-søk per NACE-kode)
2. **Hent kun oppdateringer** siden forrige kjøring
3. **Merge med eksisterende data**

**Pagination:**
- Maks (side + 1) × størrelse = 10,000
- Bruk størrelse = 100, max 100 sider per NACE-kode
- Hvis mer enn 10,000 resultater: split på fylke/kommune

---

## Fase 3: Data-struktur og Modellering

### Database-skjema (PostgreSQL + PostGIS)

```sql
-- Hovedtabell for virksomheter
CREATE TABLE brreg_entities (
  -- Identifikasjon
  orgnr VARCHAR(9) PRIMARY KEY,
  navn TEXT NOT NULL,
  organisasjonsform_kode VARCHAR(10),
  organisasjonsform_beskrivelse TEXT,

  -- Næringskoder
  naeringskode1_kode VARCHAR(10),
  naeringskode1_beskrivelse TEXT,
  naeringskode2_kode VARCHAR(10),
  naeringskode2_beskrivelse TEXT,
  naeringskode3_kode VARCHAR(10),
  naeringskode3_beskrivelse TEXT,

  -- Kontaktinformasjon
  forretningsadresse JSONB, -- adresse, postnummer, poststed, kommune, land
  postadresse JSONB,
  hjemmeside TEXT,
  epost TEXT,
  telefon TEXT,

  -- Geografi
  kommune_nummer VARCHAR(4),
  kommune_navn TEXT,
  fylke_nummer VARCHAR(2),
  fylke_navn TEXT,
  location GEOGRAPHY(Point, 4326), -- PostGIS for geografisk søk

  -- Status
  registrert_i_enhetsregisteret BOOLEAN,
  registrert_i_foretaksregisteret BOOLEAN,
  registrert_i_mva_registeret BOOLEAN,
  antall_ansatte INTEGER,
  konkurs BOOLEAN,
  under_avvikling BOOLEAN,
  under_tvangsavvikling_eller_tvangsopplosning BOOLEAN,

  -- Datoer
  stiftelsesdato DATE,
  registreringsdato_enhetsregisteret DATE,
  registreringsdato_foretaksregisteret DATE,
  sist_endret TIMESTAMP,

  -- Metadata
  imported_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  verification_notes TEXT,

  -- Kategorisering (vår egen)
  category VARCHAR(50), -- 'gym', 'pt', 'yoga', 'nutrition', etc.
  subcategories TEXT[], -- array med underkategorier
  tags TEXT[], -- søkbare tags

  -- Kvalitetsskår
  quality_score INTEGER DEFAULT 0, -- 0-100, basert på datakomplett
  relevance_score INTEGER, -- 0-100, hvor relevant for vår plattform

  -- Indekser
  CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 100)
);

-- Underenheter (filialer, avdelinger)
CREATE TABLE brreg_subunits (
  orgnr VARCHAR(9) PRIMARY KEY,
  overordnet_enhet VARCHAR(9) REFERENCES brreg_entities(orgnr),
  navn TEXT NOT NULL,
  naeringskode_kode VARCHAR(10),
  naeringskode_beskrivelse TEXT,
  forretningsadresse JSONB,
  location GEOGRAPHY(Point, 4326),
  antall_ansatte INTEGER,
  imported_at TIMESTAMP DEFAULT NOW()
);

-- Nøkkelpersoner/Roller
CREATE TABLE brreg_roles (
  id SERIAL PRIMARY KEY,
  orgnr VARCHAR(9) REFERENCES brreg_entities(orgnr),
  person_navn TEXT,
  rolle_type TEXT, -- 'DAGL' (daglig leder), 'LEDE' (styreleder), etc.
  rolle_beskrivelse TEXT,

  -- Kontakt (må hentes fra andre kilder eller manuelt)
  kontakt_epost TEXT,
  kontakt_telefon TEXT,
  kontakt_verified BOOLEAN DEFAULT FALSE,

  imported_at TIMESTAMP DEFAULT NOW()
);

-- Indekser for ytelse
CREATE INDEX idx_entities_naeringskode1 ON brreg_entities(naeringskode1_kode);
CREATE INDEX idx_entities_kommune ON brreg_entities(kommune_nummer);
CREATE INDEX idx_entities_category ON brreg_entities(category);
CREATE INDEX idx_entities_location ON brreg_entities USING GIST (location);
CREATE INDEX idx_entities_name_trgm ON brreg_entities USING GIN (navn gin_trgm_ops);
CREATE INDEX idx_entities_verified ON brreg_entities(verified) WHERE verified = TRUE;
```

---

## Fase 4: Data Enrichment (Databerikelse)

### Problem: Brønnøysundregisteret har ikke all info vi trenger

**Manglende data:**
- Direkte kontaktinfo til nøkkelpersoner (trenere, instruktører)
- Detaljert info om tilbud/tjenester
- Bilder av fasiliteter
- Prisinformasjon
- Åpningstider
- Spesialiseringer

### Løsning: Multi-kilders strategi

#### 1. Google Places API
- **Hva**: Hent kontaktinfo, bilder, vurderinger, åpningstider
- **Matching**: Bruk navn + adresse fra Brreg → søk i Google Places
- **Kostnad**: $17 per 1000 forespørsler (gratis tier: 0)
- **Begrensning**: 100,000 gratis per måned med kreditt

#### 2. Proff.no / Bisnode
- **Hva**: Utvidet bedriftsinformasjon, nøkkelpersoner med roller
- **Metode**: Web scraping (sjekk robots.txt først)
- **Alternativ**: API hvis tilgjengelig (betalt)

#### 3. Facebook Graph API
- **Hva**: Sosiale medier-profiler, kontaktinfo
- **Matching**: Søk på bedriftsnavn + lokasjon
- **Kostnad**: Gratis (med begrensninger)

#### 4. LinkedIn
- **Hva**: Nøkkelpersoner i bedriften, jobbtitler
- **Metode**: LinkedIn API (krever partnerskap) eller manuell søk
- **Utfordring**: Vanskelig å automatisere, personvernhensyn

#### 5. Offentlige nettsider
- **Hva**: Hjemmeside fra Brreg → scrape for kontaktinfo
- **Metode**: Puppeteer/Playwright for å hente e-post, telefon, sosiale medier
- **Utfordring**: Variert struktur, krever intelligent parsing

#### 6. Manuell verifikasjon
- **Hva**: Kvalitetssikring av automatisk data
- **Prosess**:
  - Prioriter store aktører (>10 ansatte)
  - Ring for å verifisere kontaktinfo
  - Inviter til plattformen samtidig
  - Bygg relasjon

### Data Enrichment Pipeline

```
Brreg Data
    ↓
[Filter & Validate]
    ↓
[Geocode addresses] (Google Geocoding API)
    ↓
[Match with Google Places] → Enrich: phone, website, photos, hours
    ↓
[Scrape company website] → Enrich: services, team, contact
    ↓
[Match with social media] → Enrich: Facebook, Instagram
    ↓
[Manual verification] → Quality score increase
    ↓
[Import to production DB]
```

---

## Fase 5: Kategorisering og Machine Learning

### Automatisk kategorisering

**Problem:** NACE-koder er for generelle

**Løsning:** Multi-faktor klassifisering

#### 1. Regelbasert (Rule-based)
```
IF naeringskode = '93.130' AND navn CONTAINS ('fitness', 'gym', 'treningssenter')
  → category = 'gym'

IF naeringskode = '86.901' AND navn CONTAINS ('PT', 'personlig trener')
  → category = 'pt'

IF organisasjonsform = 'ENK' AND navn CONTAINS person_name AND naeringskode IN health_codes
  → category = 'pt' OR 'nutrition_coach'
```

#### 2. Tekstanalyse av beskrivelser
```
Scrape website content → Extract keywords → Classify

"yoga", "pilates" → category = 'yoga'
"crossfit", "functional" → subcategory = 'functional_training'
"senior", "eldre" → tag = 'senior_friendly'
```

#### 3. Machine Learning (Fremtidig)
- Tren modell på manuelt kategoriserte bedrifter
- Features: navn, naeringskode, beskrivelse, nettside-innhold, ansatte
- Output: category, subcategories, confidence score
- Løpende forbedring basert på feedback

---

## Fase 6: Nøkkelpersoner og Kontaktnettverk

### Strategi for å finne trenere/instruktører

#### 1. Fra Brønnøysundregisteret (Roller-API)
```
GET /api/enheter/{orgnr}/roller
→ Hent: Daglig leder, Styreleder, Kontaktperson
→ Lagre i brreg_roles tabell
```

**Begrensning:** Kun offisielle roller, ikke individuell trenere

#### 2. Fra hjemmesider
```
Scrape "Om oss", "Team", "Våre trenere" sider
→ Ekstraher navn, tittel, bilde, spesialiseringer
→ Strukturer i JSON
→ Lagre i separate tabell: entity_team_members
```

#### 3. Fra sosiale medier
```
Facebook Business Page → "About" → People
Instagram Bio → Tagged trainers
LinkedIn Company Page → Employees
```

#### 4. Fra booking-systemer
```
Hvis bedrift bruker offentlig booking (Mindbody, EasyPractice, etc.)
→ Hent liste over tilgjengelige trenere fra booking-siden
```

### Database-struktur for nøkkelpersoner

```sql
CREATE TABLE entity_team_members (
  id SERIAL PRIMARY KEY,
  orgnr VARCHAR(9) REFERENCES brreg_entities(orgnr),

  -- Personinfo
  navn TEXT NOT NULL,
  rolle TEXT, -- 'Personal Trainer', 'Yoga Instructor', 'Nutrition Coach'
  bio TEXT,
  foto_url TEXT,

  -- Spesialiseringer
  spesialiseringer TEXT[], -- ['strength', 'weight_loss', 'rehab']
  sertifiseringer TEXT[], -- ['ACE', 'NASM', 'Crossfit Level 1']

  -- Kontakt
  epost TEXT,
  telefon TEXT,
  sosiale_medier JSONB, -- {instagram: '@username', facebook: '...'}

  -- Metadata
  source VARCHAR(50), -- 'website', 'facebook', 'manual'
  scraped_at TIMESTAMP,
  verified BOOLEAN DEFAULT FALSE,

  UNIQUE(orgnr, navn)
);
```

---

## Fase 7: Implementasjonsplan (Teknisk)

### 1. Bulk Import Script (Node.js/TypeScript)

```typescript
// PSEUDO-KOD - IKKE IMPLEMENTERING
class BrregImporter {
  async run() {
    // 1. Download bulk file
    const file = await this.downloadBulkFile();

    // 2. Parse and filter
    const entities = await this.parseAndFilter(file, RELEVANT_NACE_CODES);

    // 3. Geocode addresses
    const geocoded = await this.geocodeInBatches(entities);

    // 4. Insert into staging
    await this.insertToStaging(geocoded);

    // 5. Run validation
    const validated = await this.validateData();

    // 6. Promote to production
    await this.promoteToProduction(validated);
  }
}
```

### 2. Enrichment Pipeline (Queue-basert)

```typescript
// PSEUDO-KOD
class EnrichmentPipeline {
  async enrich(orgnr: string) {
    const entity = await db.getEntity(orgnr);

    // Queue jobs
    await queue.add('google-places', { orgnr });
    await queue.add('scrape-website', { orgnr, url: entity.hjemmeside });
    await queue.add('scrape-team', { orgnr, url: entity.hjemmeside });
    await queue.add('social-media', { orgnr, name: entity.navn });
  }
}

// Workers process jobs
worker('google-places', async (job) => {
  const places = await googlePlaces.search(job.data.orgnr);
  await db.updateEntity(job.data.orgnr, { ...places });
});
```

### 3. Cron Jobs

```yaml
# Daglige oppdateringer
0 6 * * * - Download ny bulk fil fra Brreg
0 7 * * * - Import nye/endrede enheter
0 8 * * * - Kjør enrichment på nye enheter

# Ukentlige jobs
0 2 * * 0 - Full re-enrichment av eksisterende (roterende batches)
0 3 * * 0 - Kvalitetskontroll og rapportering
```

### 4. Admin-verktøy

- **Bulk import dashboard**: Status, feil, statistikk
- **Manual verification queue**: Liste over nye enheter som trenger manuell sjekk
- **Category editor**: Rediger kategorier, tags, kvalitetsskår
- **Blacklist management**: Fjern irrelevante bedrifter

---

## Fase 8: Juridiske og Etiske Hensyn

### GDPR-compliance

1. **Virksomhetsdata fra Brreg**: Offentlig tilgjengelig, OK å lagre
2. **Nøkkelpersoner (navn, rolle)**: Offentlig tilgjengelig hvis i Brreg, OK
3. **Personlig kontaktinfo (e-post, telefon)**:
   - Kun hvis offentlig tilgjengelig (hjemmeside, visittkort)
   - Må ha legitim interesse
   - Tilby opt-out mulighet
4. **Web scraping**:
   - Respekter robots.txt
   - Ikke overbelast servere
   - Kun offentlig tilgjengelig info

### Bruksvilkår for API-er

- **Google Places**: Max 100,000 gratis per måned
- **Facebook**: Rate limits, krever app review for enkelte data
- **LinkedIn**: Strenge begrensninger, krever partnerskap

### Best Practices

- Lagre kun det som er nødvendig
- Anonymiser ved behov
- Tilby bedrifter mulighet til å redigere/fjerne sin info
- Transparent om datakilder

---

## Fase 9: Kostnadsestimering

### API-kostnader (for 50,000 bedrifter)

| Tjeneste | Kostnad per 1000 | Total kostnad |
|----------|------------------|---------------|
| Google Geocoding | $5 | $250 |
| Google Places | $17 | $850 |
| **Total** | | **~$1,100** |

### Infrastruktur

- **Database hosting**: Supabase Pro ($25/mnd) eller AWS RDS (~$50/mnd)
- **Queue system**: BullMQ + Redis ($10/mnd)
- **Cron jobs**: GitHub Actions (gratis) eller AWS Lambda ($5/mnd)

### Arbeidstid

- **Utvikling**: 3-4 uker (1 person)
- **Manuell verifikasjon**: 200 timer for prioriterte bedrifter
- **Løpende vedlikehold**: 5-10 timer/uke

---

## Fase 10: Validering og Kvalitetssikring

### KPIer for datakvalitet

1. **Kompletthetsgrad**: % bedrifter med alle felt utfylt
   - Mål: >80% har kontaktinfo
   - Mål: >60% har geolokasjon
   - Mål: >40% har bilder

2. **Nøyaktighet**: % bedrifter med korrekt kategorisering
   - Mål: >90% korrekt primær kategori
   - Måles via manuell stikkprøve (100 bedrifter)

3. **Aktualitet**: % bedrifter med oppdatert info
   - Mål: <5% av bedrifter er konkurs/nedlagt
   - Daglig oppdatering fra Brreg

### Valideringsprosess

```
Ny bedrift importert
    ↓
[Automatisk kategorisering] → Confidence score
    ↓
IF confidence < 70% → Send til manuell queue
IF confidence >= 70% → Auto-approve
    ↓
[Enrichment pipeline]
    ↓
[Quality score calculation]
    ↓
IF quality_score < 50 → Deprioritize
IF quality_score >= 50 → Include in search results
    ↓
[Periodic re-validation] (hver 6. mnd)
```

---

## Oppsummering: Anbefalte første steg

1. **Uke 1-2**:
   - Research og mapp alle relevante NACE-koder
   - Sett opp database-skjema
   - Implementer bulk download fra Brreg

2. **Uke 3-4**:
   - Filtrer og importer første batch (10,000 bedrifter)
   - Implementer geokoding
   - Manuell validering av 100 bedrifter for å teste kategorisering

3. **Uke 5-6**:
   - Implementer Google Places enrichment
   - Implementer web scraping for hjemmesider
   - Sett opp admin-dashbord for manuell verifikasjon

4. **Uke 7-8**:
   - Implementer cron jobs for daglig oppdatering
   - Bygge ut nøkkelperson-ekstrahering
   - Optimalisere ytelse og kostnader

5. **Løpende**:
   - Manuell verifikasjon av prioriterte bedrifter
   - Invitasjon til plattformen
   - Feedback loop for å forbedre kategorisering

---

## Risiko og Utfordringer

| Risiko | Sannsynlighet | Konsekvens | Tiltak |
|--------|---------------|------------|--------|
| Mange irrelevante bedrifter | Høy | Middels | Manuell verifikasjon, ML-klassifisering |
| Manglende kontaktinfo | Høy | Høy | Multi-kilders strategi, manuell oppfølging |
| API-kostnader eksploderer | Middels | Høy | Rate limiting, caching, batch-prosessering |
| GDPR-problemer | Lav | Høy | Juridisk rådgivning, opt-out mulighet |
| Utdatert data | Middels | Middels | Daglige oppdateringer, brukerfeedback |

---

**Konklusjon**: Dette er en ambisiøs, men gjennomførbar plan. Forventet resultat er en database med 5,000-15,000 relevante trenings- og helsebedrifter i Norge, med variert datakvalitet (50-90% komplett) avhengig av berikelse og manuell innsats.
