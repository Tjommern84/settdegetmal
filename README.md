# SettDegEtMål

Norsk markedsplass for trenings- og helsetjenester. Matcher brukere med PT-er, treningssentre, idrettslag, gruppetimer og ernæringsrådgivere basert på lokasjon, mål og preferanser.

## Teknologistack

| Lag | Teknologi |
|-----|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Database | Supabase (PostgreSQL + PostGIS) |
| Autentisering | Supabase Auth (magic link) |
| Geokoding | Nominatim (OpenStreetMap) |
| Dataimport | Serper.dev (Google Places API) |
| Betalinger | Stripe (B2C + B2B, feature-flagget) |
| E-post | Resend (feature-flagget) |
| Hosting | Vercel |

---

## Sider og ruter

| Rute | Beskrivelse |
|------|-------------|
| `/` | Hjemmeside – 4-kategorikort med GPS/stedssøk |
| `/flyt` | Guidet 5-stegs matching-flyt |
| `/resultater` | Søkeresultater med sortering og paginering |
| `/tilbyder/[id]` | Tilbyderprofil |
| `/kategorier/[id]` | Kategoriside med kuraterte tjenester |
| `/min-side` | Brukerdashboard (bookinger, forespørsler, GDPR) |
| `/dashboard` | Tilbyderdashboard (tjenester, leads) |
| `/admin` | Adminpanel (metrics, kuratering, invitasjoner) |
| `/invite/[token]` | Tilbyder-onboarding via invite-lenke |

---

## Matching-algoritme

`search_services()` i Supabase scorer tjenester slik:

| Kriterium | Poeng |
|-----------|-------|
| Mål-match | 4 |
| Type-match | 3 |
| Budsjett-match | 2 |
| Venue-match (hjemme/senter) | 2 |
| Rating ≥ 4.7 / ≥ 4.4 / ≥ 4.1 | 3 / 2 / 1 |
| Avstand ≤ 5 km / ≤ 15 km / ≤ 30 km | 3 / 2 / 1 |

### Dekning

Tjenester dekkes på tre måter i `service_coverage`:
- **`city`** – navngitt by. Fallback: proximity-matching (25 km fra tjenestens koordinater) for bydeler/tettsteder som ikke er eksakt match.
- **`radius`** – senter-punkt + radius i km (PostGIS `ST_DWithin`)
- **`region`** – `norway` eller `nordic` (landsdekkende)

---

## Oppsett

### Krav

- Node.js 18+
- Supabase-prosjekt med PostGIS aktivert
- (Valgfritt) Serper.dev API-nøkkel for dataimport
- (Valgfritt) Stripe, Resend

### Installasjon

```bash
git clone https://github.com/Tjommern84/settdegetmal.git
cd settdegetmal
npm install
cp .env.local.example .env.local   # fyll inn nøkler
npm run dev
```

### Miljøvariabler

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SERPER_API_KEY=              # dataimport via Google Places
RESEND_API_KEY=              # transaksjonell e-post (valgfritt)
STRIPE_SECRET_KEY=           # betalinger (valgfritt)
STRIPE_WEBHOOK_SECRET=       # valgfritt
NEXT_PUBLIC_ADMIN_EMAIL=     # e-post som gir admin-tilgang
```

### Database-migrasjoner

Kjør SQL-filene i `sql/` i nummerert rekkefølge i Supabase SQL-editoren:

```
sql/00_schema.sql               # Kjerneskjema (tabeller, RLS)
sql/01_postgis_and_search.sql   # PostGIS + search_services() + GRANT
sql/02_rls.sql                  # Row Level Security
sql/03_seed.sql                 # Seed-data (valgfritt)
sql/04_brreg_columns.sql        # BRREG-felter på services
sql/05_scraped_columns.sql      # Scraped-felter
sql/06_service_types.sql        # many-to-many service_types
sql/07_update_gym_locations.sql # base_location for gymkjeder
sql/08_fix_coverage_locality.sql
sql/09_sport_tags.sql
sql/10_main_category.sql        # main_category-kolonne
sql/11_backfill_tags.sql
sql/12_city_refresh_log.sql     # cooldown for bakgrunnsoppdatering
```

> **Viktig:** Bruk kun `01_postgis_and_search.sql` for `search_services()`. `postgis_matching.sql` er legacy.
> Etter enhver `DROP FUNCTION` må `GRANT EXECUTE` kjøres på nytt.

---

## Dataimport-pipeline

Data hentes fra Google Places via Serper.dev og pushes til Supabase. Scripts finnes i `scripts/`:

| Script | Kommando | Beskrivelse |
|--------|----------|-------------|
| PT-tilbydere | `npm run pt:find` / `npm run pt:push` | Personlige trenere (pt_* IDs) |
| Treningssentre | `npm run gyms:find-locations` / `npm run gyms:push` | Gymkjeder (gp_* IDs) |
| Idrettslag | `npm run clubs:find` / `npm run clubs:push` | Idrettslag (sc_* IDs) |
| Gruppetimer | `npm run groups:find` / `npm run groups:push` | Gruppetimer (gf_* IDs) |
| Ernæring | `npm run ern:find` / `npm run ern:push` | Ernæringsrådgivere (ern_* IDs) |
| Nettsider | `npm run websites:find` | Finn manglende nettsider |
| Duplikater | `npm run dedup` | Slett duplikater på tvers av alle prefiks |

Bakgrunnsoppdatering av byer skjer automatisk via `/api/refresh-city` (24-timers cooldown per by).

---

## Prosjektstruktur

```
├── app/
│   ├── actions/          # Server Actions (bookinger, anbefalinger)
│   ├── api/              # API Routes (geocode, refresh-city, m.fl.)
│   ├── dashboard/        # Tilbyderdashboard
│   ├── flyt/             # Guidet matching-flyt
│   ├── min-side/         # Brukerprofil og bookinger
│   ├── resultater/       # Søkeresultater
│   └── tilbyder/[id]/    # Tilbyderprofil
├── components/           # React-komponenter
│   ├── CategoryGrid.tsx  # Hjemmeside-grid med lokasjonssøk
│   └── ui/               # Knapper, kort, input m.m.
├── lib/                  # Forretningslogikk
│   ├── matchingDb.ts     # Kall til search_services() RPC
│   ├── categoryConfig.ts # Kategoridefinisjonar
│   ├── domain.ts         # TypeScript-typer
│   └── ...
├── scripts/              # Dataimport og vedlikehold
├── sql/                  # Database-migrasjoner
└── public/bilder/        # Kategoribilder
```

---

## Feature flags

Alle er `true` som standard. Sett til `false` i `.env.local` for å deaktivere:

```
NEXT_PUBLIC_ENABLE_REVIEWS=false
NEXT_PUBLIC_ENABLE_PAYMENTS=false
NEXT_PUBLIC_ENABLE_ADMIN=false
NEXT_PUBLIC_ENABLE_EMAILS=false
NEXT_PUBLIC_ENABLE_PILOT_MODE=false
NEXT_PUBLIC_ENABLE_PARTNER_API=false
```

---

## Deployment (Vercel)

1. Push til GitHub
2. Importer prosjektet i Vercel
3. Legg til miljøvariabler
4. Deploy – `npm run build` kjøres automatisk
