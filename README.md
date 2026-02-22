# settdegetmal.no

En markedsplasstjeneste som matcher brukere med treningstilbud basert på mål, lokasjon, budsjett og preferanser.

## Teknologistack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Server Actions
- **Database**: PostgreSQL (via Supabase) med PostGIS for geografisk søk
- **Autentisering**: Supabase Auth
- **Betalinger**: Stripe (B2C og B2B)
- **E-post**: Resend
- **Hosting**: Vercel (anbefalt)

## Funksjoner

### For brukere
- Guidet matching-flyt for å finne riktig treningstilbud
- Geografisk søk med støtte for radius, byer og regioner
- Smart sortering basert på mål, type, budsjett, avstand og rating
- Personaliserte anbefalinger basert på tidligere aktivitet
- Booking-system
- GDPR-kompatibel med samtykke-håndtering

### For tilbydere
- Dashboard for administrasjon av tjenester
- Lead-håndtering
- Profil- og tjenesteoppsett
- Stripe-integrasjon for betalinger

### For administratorer
- Admin-panel for kuratering av innhold
- Kategoristyring
- Tilbyder-invitasjoner

## Oppsett

### Forutsetninger

- Node.js 18+ og npm
- PostgreSQL-database (via Supabase)
- Stripe-konto (valgfritt for betalinger)
- Resend-konto (valgfritt for e-post)

### Installasjon

1. Klon repositoryet:
```bash
git clone <repository-url>
cd SettDegEtMal
```

2. Installer avhengigheter:
```bash
npm install
```

3. Opprett `.env.local` basert på `.env.example`:
```bash
cp .env.example .env.local
```

4. Konfigurer miljøvariabler i `.env.local`:
   - Legg til Supabase URL og nøkler
   - Legg til Stripe-nøkler (valgfritt)
   - Legg til Resend API-nøkkel (valgfritt)
   - Sett admin e-post

5. Sett opp databasen:
   - Kjør SQL-skriptene i `sql/`-mappen i følgende rekkefølge:
     1. `postgis_matching.sql` - Aktiverer PostGIS og oppretter søkefunksjon
     2. `locations.sql` - Lokasjonshåndtering
     3. `categories.sql` - Kategorier
     4. `bookings.sql` - Booking-system
     5. `user_preferences.sql` - Brukerpreferanser
     6. `notification_preferences.sql` - Varslingsinnstillinger
     7. `service_media.sql` - Tjeneste-media
     8. `search_cache.sql` - Søkecache
     9. `indexes.sql` - Ytelsesindekser

6. Start utviklingsserveren:
```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000) i nettleseren.

## Prosjektstruktur

```
.
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions
│   ├── api/               # API Routes
│   ├── dashboard/         # Tilbyder-dashboard
│   ├── flyt/              # Matching-flyt
│   ├── resultater/        # Søkeresultater
│   └── tilbyder/          # Tilbyder-profiler
├── components/            # Gjenbrukbare komponenter
│   └── ui/                # UI-komponenter
├── lib/                   # Forretningslogikk og utilities
│   ├── matching.ts        # Matching-algoritme
│   ├── matchingDb.ts      # Database-basert matching
│   ├── supabaseClient.ts  # Supabase-klient
│   └── stripe.ts          # Stripe-integrasjon
├── sql/                   # Database-skjemaer
└── public/                # Statiske filer
```

## Viktige konsepter

### Matching-algoritme

Systemet bruker en avansert matching-algoritme som scorer tjenester basert på:
- **Mål-match** (4 poeng): Om tjenesten støtter brukerens mål
- **Type-match** (3 poeng): Om tjenesten er av ønsket type
- **Budsjett-match** (2 poeng): Om prisen passer budsjettet
- **Venue-match** (2 poeng): Om tjenesten tilbys der brukeren ønsker (hjemme/senter)
- **Rating** (0-3 poeng): Basert på gjennomsnittlig rating
- **Avstand** (0-3 poeng): Geografisk nærhet til bruker

### Geografisk søk

Tjenester kan definere dekning på tre måter:
- **Radius**: Senter-punkt med radius i km
- **Byer**: Liste over spesifikke byer
- **Region**: `norway` eller `nordic`

PostGIS brukes for effektiv geografisk søk og avstandsberegning.

### Feature Flags

Prosjektet støtter feature flags for gradvis utrulling:
- `NEXT_PUBLIC_ENABLE_REVIEWS`: Aktiverer vurderinger
- `NEXT_PUBLIC_ENABLE_PAYMENTS`: Aktiverer Stripe-betalinger
- `NEXT_PUBLIC_ENABLE_ADMIN`: Aktiverer admin-panel
- `NEXT_PUBLIC_ENABLE_EMAILS`: Aktiverer e-postutsending
- `NEXT_PUBLIC_ENABLE_PILOT_MODE`: Pilot-modus
- `NEXT_PUBLIC_ENABLE_PARTNER_API`: Partner API

## Utvikling

### Kjøre tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Bygge for produksjon
```bash
npm run build
npm start
```

## Deployment

Prosjektet er optimalisert for Vercel:

1. Push koden til GitHub
2. Importer prosjektet i Vercel
3. Legg til miljøvariabler
4. Deploy

## Sikkerhet

- Alle autentiserte endepunkter bruker Supabase Auth
- API-ruter validerer tokens og autorisasjon
- GDPR-kompatibel med samtykke-håndtering
- Rate limiting på eksterne API-kall (geocoding)
- SQL injection-beskyttelse via Supabase RLS og parametriserte queries

## Bidra

For å bidra til prosjektet:
1. Fork repositoryet
2. Opprett en feature branch
3. Commit endringene dine
4. Push til branchen
5. Åpne en Pull Request

## Lisens

[Legg til lisens her]

## Kontakt

For spørsmål eller support, kontakt [din@epost.no]
