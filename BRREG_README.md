# Brønnøysundregisteret Import System

Komplett system for å importere, filtrere og berike bedriftsdata fra Brønnøysundregisteret.

## Oversikt

Dette systemet:
1. Laster ned bulk-data fra Brønnøysundregisteret (alle norske bedrifter)
2. Filtrerer på relevante NACE-koder (helse, trening, fitness)
3. Kategoriserer automatisk basert på NACE-koder og bedriftsnavn
4. Geokoder adresser til GPS-koordinater (via Nominatim)
5. Beregner kvalitets- og relevansskårer
6. Tilbyr admin-grensesnitt for verifikasjon

## Oppsett

### 1. Database-skjema

Kjør SQL-skjemaet for å opprette tabeller:

```bash
# Koble til Supabase SQL Editor og kjør:
sql/brreg_entities.sql
```

Dette oppretter:
- `brreg_entities` - Hovedtabell for bedrifter
- `brreg_subunits` - Underenheter (filialer)
- `brreg_import_log` - Importlogg
- `brreg_enrichment_queue` - Kø for datab erikelse

### 2. Installer avhengigheter

```bash
npm install
```

Dette installerer også `tsx` for å kjøre TypeScript-scripts direkte.

### 3. Konfigurer miljøvariabler

Sørg for at du har disse i `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Bruk

### Import av bulk-data

**Full import (første gang):**
```bash
npm run brreg:import
```

Dette:
- Laster ned ~50-100 MB komprimert data
- Dekomprimerer og parser ~1M bedrifter
- Filtrerer til ~5,000-15,000 relevante bedrifter
- Importerer til database
- Køer opp for geokoding

**Dry run (testing):**
```bash
npm run brreg:import:dry
```

Importerer kun 100 bedrifter og skriver ikke til databasen.

**Egendefinerte opsjoner:**
```bash
# Kun 500 bedrifter
npm run brreg:import -- --limit=500

# Hopp over nedlasting (bruk eksisterende fil)
npm run brreg:import -- --skip-download

# Hopp over geokoding
npm run brreg:import -- --skip-geocode
```

### Geokoding

Geokoding konverterer adresser til GPS-koordinater.

**Geokode 100 bedrifter (standard):**
```bash
npm run brreg:geocode
```

**Test med 10 bedrifter:**
```bash
npm run brreg:geocode:test
```

**Egendefinerte opsjoner:**
```bash
# Geokode 500 bedrifter
npm run brreg:geocode -- --limit=500

# Kun høy-prioritet bedrifter
npm run brreg:geocode -- --priority=70
```

**Viktig:** Geokoding er begrenset til 1 forespørsel per sekund (Nominatim rate limit).
- 100 bedrifter = ~2 minutter
- 1,000 bedrifter = ~17 minutter
- 10,000 bedrifter = ~3 timer

### Admin-grensesnitt

Besøk `/admin/brreg` for å se importerte data:

```
http://localhost:3000/admin/brreg
```

Funksjoner:
- Se statistikk over importerte bedrifter
- Filtrer på kategori og verifiseringsstatus
- Se kvalitets- og relevansskårer
- Paginering gjennom resultater

## Datamodell

### Kategorier

Systemet kategoriserer automatisk bedrifter i:
- `gym` - Treningssentre, fitness
- `pt` - Personlige trenere
- `yoga` - Yoga/pilates-studioer
- `physio` - Fysioterapi
- `nutrition` - Kostholdsveiledning
- `rehab` - Rehabilitering
- `sports` - Generell sport

### Kvalitetsskår (0-100)

Basert på datakompletthetsgrad:
- Grunnleggende info (navn, orgnr, NACE): 25 poeng
- Kontaktinfo (adresse, hjemmeside): 30 poeng
- Geolokasjon: 20 poeng
- Forretningsstatus: 15 poeng
- Tilleggsdata (ansatte, stiftelsesdato): 10 poeng

### Relevansskår (0-100)

Hvor relevant bedriften er for vår plattform:
- Primær NACE-kode match: 25-40 poeng
- Nøkkelord i navn: 15-30 poeng
- Aktiv i registre: 10 poeng
- Antall ansatte: 5-10 poeng
- Har hjemmeside: 5 poeng
- Ikke konkurs: 5 poeng

## Dataflyt

```
Brønnøysundregisteret (bulk download)
    ↓
[Filter på NACE-koder]
    ↓
[Automatisk kategorisering]
    ↓
[Database import]
    ↓
[Geokoding-kø]
    ↓
[Nominatim geokoding]
    ↓
[Kvalitetsskår-beregning]
    ↓
[Admin-verifikasjon]
```

## Relevante NACE-koder

Systemet filtrerer på disse næringskodene:

**Direkte fitness/sport:**
- 93.130 - Treningssentre og gymsaler
- 93.199 - Andre sportsaktiviteter
- 93.110 - Drift av idrettsanlegg
- 93.190 - Andre sportsaktiviteter

**Helse:**
- 86.901 - Fysioterapivirksomhet
- 86.909 - Annen helsetjeneste
- 86.903 - Kiropraktikk

**Personlig velvære:**
- 96.040 - Virksomhet tilknyttet personlig velvære
- 96.099 - Annen personlig tjenesteyting

Se full liste i `lib/brreg/types.ts`.

## Vedlikehold

### Daglig oppdatering

Sett opp en cron job for daglig oppdatering:

```bash
# Hver dag kl 06:00 (etter at Brreg har oppdatert kl 05:00)
0 6 * * * cd /path/to/project && npm run brreg:import
```

### Geokoding i bakgrunnen

Kjør geokoding kontinuerlig:

```bash
# Hver time, geokode 100 bedrifter
0 * * * * cd /path/to/project && npm run brreg:geocode -- --limit=100
```

## Feilsøking

### "Failed to download"
- Sjekk internettforbindelse
- Brreg API kan være nede midlertidig
- Prøv igjen senere

### "Failed to parse line"
- Dette er normalt, noen linjer kan være korrupte
- Scriptet fortsetter med neste linje

### "Geocoding failed"
- Nominatim kan være nede
- Rate limit kan være overskredet (vent 1 time)
- Noen adresser kan ikke geokodes (mangelfulle data)

### "Database error"
- Sjekk at Supabase er konfigurert riktig
- Verifiser miljøvariabler
- Sjekk at skjemaet er kjørt

## Kostnader

**API-kostnader:**
- Brønnøysundregisteret: **GRATIS**
- Nominatim (OpenStreetMap): **GRATIS**

**Infrastruktur:**
- Database (Supabase): $25-50/måned
- Diskplass for bulk-filer: ~500 MB per fil

**Total kostnad: ~$25-50/måned** (ingen per-request kostnader!)

## Neste steg

1. **Manuelle verifikasjoner**: Gå gjennom topp 100 bedrifter og verifiser
2. **Web scraping**: Hent kontaktinfo fra hjemmesider
3. **Google Places**: Berik med bilder, vurderinger (koster penger)
4. **Sosiale medier**: Finn Facebook/Instagram-profiler
5. **Nøkkelpersoner**: Ekstraher trenere og instruktører

Se `DATABUILD_STRATEGY.md` for full strategi.
