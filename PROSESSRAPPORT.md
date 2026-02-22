# Prosessrapport: settdegetmal.no

**Versjon:** 0.1.0
**Status:** Funksjonelt MVP
**Generert:** 2026-02-03
**Formål:** Gi ekstern teknisk rådgiver full oversikt over prosjektet

---

## 1. Prosjektoversikt

### Hva prosjektet er
**settdegetmal.no** er en norsk markedsplasstjeneste som matcher sluttbrukere med trenings- og helsetilbydere. Plattformen fungerer som en "Finn.no for trening" der brukere besvarer et kort spørreskjema om sine mål, budsjett og preferanser, og deretter får presentert relevante tilbydere sortert etter match-score.

### Sluttproduktets funksjon
- Guidet matching-flyt for brukere (mål → type → lokasjon → budsjett → resultater)
- Geografisk søk med støtte for radius, byer og regioner (PostGIS)
- Lead-generering mellom brukere og tilbydere
- Tilbyder-dashboard for administrasjon og lead-håndtering
- Automatisk import av treningsrelaterte bedrifter fra Brønnøysundregisteret
- Booking- og betalingsflyt via Stripe

### Målbrukere
1. **Sluttbrukere:** Privatpersoner som søker treningstjenester (PT, yoga, gym, kostholdsveiledning)
2. **Tilbydere:** Treningssentre, personlige trenere, yoga-studioer, fysioterapeuter, ernæringsveiledere
3. **Administratorer:** Intern drift for kuratering, kvalitetssikring og overvåkning

### Arkitektur og stack

| Lag | Teknologi |
|-----|-----------|
| **Frontend** | Next.js 14 (App Router), React 18.2, TypeScript 5.5.4, Tailwind CSS 3.4 |
| **Backend** | Next.js API Routes, Server Actions |
| **Database** | PostgreSQL (Supabase) med PostGIS for geografisk søk |
| **Autentisering** | Supabase Auth |
| **Betalinger** | Stripe (separate B2C og B2B integrasjoner) |
| **E-post** | Resend |
| **Geokoding** | Nominatim/OpenStreetMap (gratis) |
| **Hosting** | Optimalisert for Vercel |

**Arkitekturdiagram:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Next.js    │────▶│  Supabase   │
│   (React)   │◀────│  Server     │◀────│  (Postgres) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │ Stripe │  │ Resend │  │Nominatim│
         └────────┘  └────────┘  └────────┘
```

---

## 2. Gjennomførte jobber (utført arbeid)

### 2.1 Funksjonalitet

| Jobb | Beskrivelse | Hvorfor | Status |
|------|-------------|---------|--------|
| **Matching-flyt** (`/flyt`) | 5-stegs wizard: mål → tjenestetype → lokasjon → budsjett → venue | Kjernefunksjonalitet for å matche brukere med tilbydere | Ferdig |
| **Resultater** (`/resultater`) | Server-rendret resultatside med scoring og sortering | Vise matchende tilbydere rangert etter relevans | Ferdig |
| **Tilbyderprofiler** (`/tilbyder/[id]`) | Detaljside per tjeneste med rating, booking, beskrivelse | La brukere se detaljer før kontakt | Ferdig |
| **Lead-system** | Opprettelse av leads, meldinger mellom bruker og tilbyder | Koble interesserte brukere med tilbydere | Ferdig |
| **Booking-flyt** | Bruker kan booke tjenester, Stripe-betaling | Muliggjøre direkte transaksjoner | Ferdig |
| **Anbefalinger** | Kuraterte anbefalinger basert på brukeraktivitet | Øke konvertering og brukerengasjement | Foreløpig ferdig |
| **SEO-landingssider** (`/trening/[by]/[goal]`) | Statiske sider per by/kategori-kombinasjon | Organisk trafikk via søkemotorer | Ferdig |

### 2.2 UI / UX

| Jobb | Beskrivelse | Hvorfor | Status |
|------|-------------|---------|--------|
| **UI-komponentbibliotek** | Button, Card, Input, Chip i `components/ui/` | Konsistent design, gjenbrukbarhet | Ferdig |
| **ProviderCard** | Kort for visning av tilbydere i resultatliste | Effektiv presentasjon av tilbud | Ferdig |
| **TopNav / Footer** | Navigasjon og bunntekst | Standard brukeropplevelse | Ferdig |
| **ConsentGate** | GDPR-samtykkeflyt ved første besøk | Lovpålagt compliance | Ferdig |
| **Mobilresponsivt design** | Tailwind-basert responsivt layout | Støtte for alle skjermstørrelser | Foreløpig ferdig |
| **FeedbackModal** | Modal for bruker-tilbakemeldinger | Samle innsikt fra brukere | Ferdig |

### 2.3 Backend / Database

| Jobb | Beskrivelse | Hvorfor | Status |
|------|-------------|---------|--------|
| **PostGIS-søk** | `search_services` RPC med spatial indexes | Rask geografisk matching | Ferdig |
| **Matching-algoritme** | Scoring: mål (4p), type (3p), budsjett (2p), venue (2p), rating (0-3p), avstand (0-3p) | Rangere tilbydere etter relevans | Ferdig |
| **Coverage-modell** | Radius, byer, region-støtte for tilbydere | Fleksibel dekningsområde-definisjon | Ferdig |
| **Caching** | `search_cache` + `service_cache` med 5 min TTL | Redusere databasebelastning | Ferdig |
| **Cache invalidation** | Automatisk tømming ved profiloppdateringer | Holde data fersk | Ferdig |
| **Error logging** | `app_errors`-tabell + `wrapServerAction` | Feilsporing i produksjon | Ferdig |
| **Brreg-import** | Komplett system for import fra Brønnøysundregisteret | Automatisk datapopulasjon | Ferdig |
| **Geokoding** | Nominatim-integrasjon med rate limiting og kø | GPS-koordinater for tilbydere | Ferdig |

### 2.4 Integrasjoner

| Jobb | Beskrivelse | Hvorfor | Status |
|------|-------------|---------|--------|
| **Stripe B2C** | Betaling fra brukere for bookinger | Inntektsmodell | Ferdig |
| **Stripe B2B** | Abonnementsbetalinger fra tilbydere | Inntektsmodell | Ferdig |
| **Stripe Webhooks** | Asynkron håndtering av betalingsstatus | Pålitelig transaksjonshåndtering | Ferdig |
| **Resend e-post** | Transaksjonelle e-poster (booking, lead) | Kommunikasjon med brukere | Ferdig |
| **Brønnøysundregisteret API** | Bulk-nedlasting og parsing av bedriftsdata | Automatisk datapopulasjon | Ferdig |
| **Nominatim/OSM** | Adresse-til-GPS konvertering | Geolokalisering av tilbydere | Ferdig |

### 2.5 Feilsøking / Stabilisering

| Jobb | Symptom | Løsning | Status |
|------|---------|---------|--------|
| **ResultsView syntax error** | Build-feil i ResultsView.tsx | Fikset JSX-syntaks | Løst |
| **"use server" export** | `recommendations.ts` feilet ved import | Rettet eksport-struktur for server actions | Løst |
| **emailTemplates exports** | Manglende eksporter for booking-maler | Lagt til manglende exports | Løst |
| **Cache staleness** | Oppdaterte tjenester viste gammel data | Implementert `invalidateServiceCaches` | Løst |
| **Rate limiting geocoding** | Nominatim blokkerte forespørsler | Lagt inn 1 req/sek limit og kø-system | Løst |

### 2.6 Tekniske beslutninger / Avklaringer

| Beslutning | Begrunnelse |
|------------|-------------|
| **Server Components først** | Reduserer client bundle, bedre SEO, enklere data-fetching |
| **500-grense på resultater** | Pragmatisk grense for å unngå ytelsesproblemer; kan utvides med paginering |
| **Fallback provider list** | Statisk liste i `lib/providers.ts` sikrer funksjonalitet uten Supabase |
| **Separate Stripe-kontoer B2C/B2B** | Tydelig separasjon av bruker- og tilbyderbetalinger |
| **PostGIS fremfor Elasticsearch** | Enklere stack, god nok ytelse for forventet volum |
| **Nominatim fremfor Google Geocoding** | Gratis, ingen API-kostnader per request |

---

## 3. Nylige problemer og hvordan de ble løst

### 3.1 ResultsView syntax error

| Felt | Verdi |
|------|-------|
| **Symptomer** | Build feilet med syntax error i `app/resultater/ResultsView.tsx` |
| **Rotårsak** | Malformed JSX, trolig fra feil merge eller kopiering |
| **Tiltak** | Manuell gjennomgang og fiksing av JSX-struktur |
| **Status** | Løst |

### 3.2 Server Action exports

| Felt | Verdi |
|------|-------|
| **Symptomer** | Runtime-feil ved bruk av anbefalinger |
| **Rotårsak** | `"use server"` direktiv og eksportstruktur i `recommendations.ts` var feil konfigurert |
| **Tiltak** | Restrukturert filen med korrekt "use server" øverst og named exports |
| **Status** | Løst |

### 3.3 E-postmaler for booking

| Felt | Verdi |
|------|-------|
| **Symptomer** | Booking-bekreftelser sendte ikke e-post |
| **Rotårsak** | `emailTemplates.ts` manglet exports for booking-relaterte maler |
| **Tiltak** | Lagt til manglende exports: `bookingConfirmation`, `bookingNotification` |
| **Status** | Løst |

### 3.4 Caching-problemer

| Felt | Verdi |
|------|-------|
| **Symptomer** | Tilbydere som oppdaterte profilen sin så ikke endringene |
| **Rotårsak** | Cache ble ikke invalidert ved profiloppdatering |
| **Tiltak** | Implementert `invalidateServiceCaches()` som kalles ved alle relevante mutasjoner |
| **Status** | Løst |

### 3.5 Geokoding rate limiting

| Felt | Verdi |
|------|-------|
| **Symptomer** | Nominatim returnerte 429 Too Many Requests |
| **Rotårsak** | Ingen rate limiting på geocoding-kall |
| **Tiltak** | Implementert 1 req/sek limit, kø-system, og retry-logikk i `lib/brreg/geocoder.ts` |
| **Status** | Løst |

---

## 4. Gjenstående jobber (mot ferdig produkt)

### 4.1 Kritisk (må på plass før lansering)

| Jobb | Beskrivelse | Avhengigheter | Omfang |
|------|-------------|---------------|--------|
| **Autentisering for admin** | `// TODO: Add proper auth check` i `/admin/brreg` | Ingen | Liten |
| **RLS-verifisering** | Bekreft at Row Level Security er korrekt for alle sensitives tabeller | Supabase | Middels |
| **E2E-test av kritiske flyter** | Test matching → resultater → lead → booking-flyten | Jest/Playwright setup | Middels |
| **Produksjonsmiljø-sjekk** | Verifiser alle ENV-variabler, Stripe-modus, domene-oppsett | Vercel/Supabase | Liten |
| **Personvern/vilkår-sider** | Publiser `/personvern`, `/vilkar`, `/cookies` | Juridisk innhold | Liten |
| **Backup-rutiner** | Verifiser Supabase backup-plan | Supabase | Liten |

### 4.2 Viktig (bør på plass kort tid etter lansering)

| Jobb | Beskrivelse | Avhengigheter | Omfang |
|------|-------------|---------------|--------|
| **Unit tests for matching** | Jest-tester for scoring-algoritmen | Jest setup | Middels |
| **Error boundaries** | React error boundaries rundt kritiske komponenter | Ingen | Liten |
| **Sentry-integrasjon** | Produksjonsovervåkning og alerting | Sentry-konto | Liten |
| **Lighthouse >90** | Performance-optimalisering, lazy loading, bilde-optimalisering | Ingen | Middels |
| **Paginering i resultater** | Fjerne 500-grensen, implementere infinite scroll | Database-endring | Middels |
| **Tilbyder-onboarding** | Forbedret flyt for nye tilbydere | UX-design | Middels |
| **2FA for tilbydere/admin** | Totrinnsfaktorautentisering | Supabase Auth | Middels |

### 4.3 Nice-to-have

| Jobb | Beskrivelse | Avhengigheter | Omfang |
|------|-------------|---------------|--------|
| **A/B-testing rammeverk** | Test ulike versjoner av UI | Analytics | Stor |
| **Favoritter-funksjon** | Brukere kan lagre favoritt-tilbydere | Database-skjema | Liten |
| **Sammenlign tjenester** | Side-ved-side sammenligning | UI-komponent | Middels |
| **In-app chat** | Meldinger mellom bruker og tilbyder i plattformen | WebSocket/Realtime | Stor |
| **Kalenderintegrasjon** | Google Calendar, Outlook-synk for tilbydere | OAuth | Stor |
| **ML-basert matching** | Forbedre algoritme med maskinlæring | Treningsdata | Stor |

---

## 5. Tekniske risikoer og uklarheter

### 5.1 Teknisk gjeld

| Område | Beskrivelse | Alvorlighet |
|--------|-------------|-------------|
| **Ingen tester** | Prosjektet har 0 test-filer i `app/`, `lib/`, `components/` | Høy |
| **TODO i kode** | `// TODO: Add proper auth check` i admin/brreg | Middels |
| **500-grense hardkodet** | Resultatsiden henter maks 500 tjenester | Middels |
| **Fallback til statisk liste** | Uten Supabase-konfig brukes `lib/providers.ts` - kan gi misvisende data | Lav |
| **Ingen CI/CD** | Ingen automatisert testing eller deploy-pipeline | Middels |

### 5.2 Antakelser som ikke er verifisert

| Antakelse | Risiko |
|-----------|--------|
| **PostGIS skalerer til 50k+ tjenester** | Ikke lasttestet med reelt datavolum |
| **Nominatim rate limit er tilstrekkelig** | Ved stor vekst kan 1 req/sek bli flaskehals |
| **Stripe webhook-reliability** | Ingen retry-mekanisme ved feilede webhooks |
| **Supabase Free tier holder** | Ved vekst må oppgraderes til Pro ($25/mnd+) |

### 5.3 Manglende tester/validering/dokumentasjon

| Område | Mangler |
|--------|---------|
| **Unit tests** | Ingen for matching-algoritme, coverage, eller utils |
| **Integration tests** | Ingen for API-ruter eller server actions |
| **E2E tests** | Ingen for brukerflyter |
| **API-dokumentasjon** | Ingen OpenAPI/Swagger-spec |
| **Lasttest** | Ikke utført |
| **Penetrasjonstest** | Ikke utført |

---

## 6. Anbefalt neste steg

### Prioritert handlingsplan (1-5)

**1. Sikre admin-endepunkter (1-2 timer)**
- Legg til autentisering i `/admin/brreg`
- Verifiser RLS på alle sensitives tabeller
- Test med uautentisert bruker

**2. Sett opp testinfrastruktur (1 dag)**
- Installer Jest + React Testing Library
- Skriv 3-5 unit tests for `lib/matching.ts`
- Sett opp CI med GitHub Actions

**3. Kjør launch checklist (2-4 timer)**
- Gå gjennom `LAUNCH_CHECKLIST.md` punkt for punkt
- Verifiser alle ENV-variabler i produksjon
- Publiser juridiske sider

**4. Implementer produksjonsovervåkning (2-4 timer)**
- Integrer Sentry for error tracking
- Sett opp alerting for kritiske feil
- Verifiser at `app_errors`-tabellen fungerer

**5. Performance-optimalisering (1-2 dager)**
- Kjør Lighthouse på alle hovedsider
- Implementer bilde-optimalisering med next/image
- Lazy-load tunge komponenter
- Mål: Lighthouse score > 90

---

## Vedlegg: Nøkkelfiler

| Fil | Beskrivelse |
|-----|-------------|
| `lib/matching.ts` | Klient-side scoring-algoritme |
| `lib/matchingDb.ts` | Database-RPC wrapper med caching |
| `sql/postgis_matching.sql` | PostGIS søkefunksjon |
| `lib/errorLogger.ts` | Error tracking til `app_errors` |
| `lib/brreg/` | Komplett Brreg-importsystem |
| `ROADMAP.md` | Utviklingsplan fase 1-7 |
| `TECH_NOTES.md` | Arkitekturbeslutninger |
| `LAUNCH_CHECKLIST.md` | Pre-launch sjekkliste |

---

**Prosjektet vurderes per nå som: Funksjonelt MVP, med hovedfokus videre på: testing, admin-sikkerhet, og produksjonsovervåkning.**
