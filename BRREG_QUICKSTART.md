# Quick Start: Brønnøysundregisteret Import

Kom i gang på 5 minutter - **INGEN DATABASE NØDVENDIG!**

## 1. Installer avhengigheter (1 minutt)

```bash
npm install
```

## 2. Eksporter til SQLite + CSV (5-10 minutter)

```bash
# Laster ned, filtrerer, og lagrer til SQLite + CSV
npm run brreg:export
```

Dette lagrer:
- `data/brreg/export-2026-01-28.sqlite` - SQLite database (kan gjøre SQL-spørringer)
- `data/brreg/export-2026-01-28.csv` - CSV-fil (kan åpnes i Excel)

## 3. Åpne og utforsk data

**SQLite (anbefalt):**
Last ned [DB Browser for SQLite](https://sqlitebrowser.org/) og åpne `.sqlite` filen.

**CSV:**
Åpne `.csv` filen i Excel eller Google Sheets.

**Se eksempler:** [SQLITE_USAGE.md](SQLITE_USAGE.md)

---

## Alternativ: Test-import (2 minutter)

```bash
# Dry run med 100 bedrifter (viser i console)
npm run brreg:import:dry
```

Du vil se output som:
```
🚀 Starting Brønnøysundregisteret import
⬇️  Downloading: 100% (52.3 MB / 52.3 MB)
✓ Downloaded to data/brreg/enheter-2026-01-28.json
🔍 Parsing and filtering entities...
   Parsed: 1,000,000, Relevant: 12,347
✓ Found 12,347 relevant entities out of 1,000,000
🗺️  Mapping to database format...
🏃 Dry run - skipping database insert

Sample entities:
1. Oslo Treningssenter AS (123456789)
   Category: gym
   NACE: 93.130 - Treningssentre og gymsaler
   Relevance: 85/100
...
```

## 4. Full import (5-10 minutter)

```bash
# Faktisk import til database
npm run brreg:import
```

## 5. Geokod 10 bedrifter (30 sekunder)

```bash
npm run brreg:geocode:test
```

## 6. Se resultater

Åpne nettleseren:
```
http://localhost:3000/admin/brreg
```

## Neste steg

**For produksjon:**
```bash
# Full import uten begrensninger
npm run brreg:import

# Geokod alle (tar flere timer)
npm run brreg:geocode -- --limit=10000
```

**Sett opp daglig oppdatering:**

Legg til i cron (Linux/Mac) eller Task Scheduler (Windows):
```bash
0 6 * * * cd /path/to/project && npm run brreg:import
```

Se `BRREG_README.md` for full dokumentasjon!
