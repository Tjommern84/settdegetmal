# SQLite Database Usage

Etter at du har kjørt `npm run brreg:export`, vil du ha en SQLite-database i `data/brreg/export-YYYY-MM-DD.sqlite`.

## Åpne databasen

### GUI (anbefalt for nybegynnere)
Last ned [DB Browser for SQLite](https://sqlitebrowser.org/) (gratis):
- Windows: https://sqlitebrowser.org/dl/
- Mac: `brew install --cask db-browser-for-sqlite`
- Linux: `sudo apt install sqlitebrowser`

Åpne filen `export-2026-01-28.sqlite` i programmet.

### CLI (command line)
```bash
# Windows
sqlite3 data/brreg/export-2026-01-28.sqlite

# Mac/Linux
sqlite3 data/brreg/export-2026-01-28.sqlite
```

## Eksempel SQL-spørringer

### Alle treningssentre
```sql
SELECT navn, forretningsadresse_poststed, relevance_score, hjemmeside
FROM entities
WHERE category = 'gym'
ORDER BY relevance_score DESC
LIMIT 100;
```

### Fysioterapeuter i Oslo
```sql
SELECT navn, forretningsadresse_adresse, hjemmeside, antall_ansatte
FROM entities
WHERE category = 'physio'
  AND (forretningsadresse_poststed LIKE '%OSLO%'
       OR forretningsadresse_kommune LIKE '%OSLO%')
ORDER BY quality_score DESC;
```

### Bedrifter med hjemmeside
```sql
SELECT navn, hjemmeside, category, relevance_score
FROM entities
WHERE hjemmeside IS NOT NULL
ORDER BY relevance_score DESC
LIMIT 50;
```

### Statistikk per kategori
```sql
SELECT
  category,
  COUNT(*) as antall,
  AVG(relevance_score) as avg_relevans,
  AVG(quality_score) as avg_kvalitet,
  AVG(antall_ansatte) as avg_ansatte
FROM entities
GROUP BY category
ORDER BY antall DESC;
```

### Beste bedrifter (høy relevans + kvalitet)
```sql
SELECT
  navn,
  category,
  forretningsadresse_poststed,
  relevance_score,
  quality_score,
  (relevance_score + quality_score) / 2 as total_score,
  hjemmeside,
  antall_ansatte
FROM entities
WHERE relevance_score >= 40
  AND quality_score >= 50
ORDER BY total_score DESC
LIMIT 100;
```

### Alle NACE-koder
```sql
SELECT DISTINCT
  naeringskode1_kode,
  naeringskode1_beskrivelse,
  COUNT(*) as antall
FROM entities
GROUP BY naeringskode1_kode
ORDER BY antall DESC;
```

### Eksporter til CSV fra SQLite
```sql
.headers on
.mode csv
.output gyms.csv
SELECT * FROM entities WHERE category = 'gym' ORDER BY relevance_score DESC;
.quit
```

## Bruk i Node.js / Next.js

```typescript
import Database from 'better-sqlite3';

const db = new Database('data/brreg/export-2026-01-28.sqlite', {
  readonly: true, // Åpne i read-only mode
});

// Hent alle gyms
const gyms = db.prepare(`
  SELECT * FROM entities
  WHERE category = 'gym'
  ORDER BY relevance_score DESC
`).all();

console.log(`Fant ${gyms.length} gyms`);

// Søk etter navn
const searchTerm = 'fitness';
const results = db.prepare(`
  SELECT * FROM entities
  WHERE navn LIKE ?
  ORDER BY relevance_score DESC
`).all(`%${searchTerm}%`);

// Husk å lukke
db.close();
```

## Tips

1. **Indekser er allerede laget** på category, relevance_score, quality_score, og poststed
2. **SQLite støtter LIKE** for tekstsøk: `WHERE navn LIKE '%fitness%'`
3. **Case-insensitive søk** i SQLite: `WHERE LOWER(navn) LIKE LOWER('%Oslo%')`
4. **Full-text search** kan legges til ved behov

## Migrere til PostgreSQL

Når du vil migrere til PostgreSQL:

```bash
# Eksporter fra SQLite
sqlite3 export-2026-01-28.sqlite .dump > export.sql

# Importer til PostgreSQL
psql settdegmal < export.sql
```

Eller bruk [pgloader](https://pgloader.io/):
```bash
pgloader export-2026-01-28.sqlite postgresql://localhost/settdegmal
```
