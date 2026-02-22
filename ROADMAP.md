# Utviklingsplan for settdegetmal.no

## Faser

### Fase 1: Grunnleggende stabilitet (Ferdig)
**Status**: ✅ Fullført

- [x] Kjernefunksjonalitet (matching, søk, profiler)
- [x] Database-skjema med PostGIS
- [x] Autentisering via Supabase
- [x] Grunnleggende UI med Tailwind CSS
- [x] Stripe-integrasjon (B2C og B2B)
- [x] E-postutsending via Resend

**Nylig fikset:**
- [x] ResultsView.tsx syntax error
- [x] "use server" export problem i recommendations.ts
- [x] Manglende emailTemplates exports for booking
- [x] .env.example og README.md dokumentasjon

---

## Fase 2: Kvalitetssikring og testing (Pågår)
**Estimert tid**: 2-3 uker
**Prioritet**: Høy

### Testing
- [ ] Sette opp Jest og React Testing Library
- [ ] Unit tests for matching-algoritme
- [ ] Unit tests for geografisk søk
- [ ] Integration tests for API-ruter
- [ ] E2E tests med Playwright/Cypress for kritiske flyter:
  - [ ] Matching-flyt (fra start til resultat)
  - [ ] Lead-opprettelse
  - [ ] Booking-flyt
  - [ ] Tilbyder-registrering

### Feilhåndtering og logging
- [ ] Forbedre error boundaries i React-komponenter
- [ ] Strukturert logging med ulike nivåer (debug, info, warn, error)
- [ ] Sentry-integrasjon for produksjonsovervåkning
- [ ] Better error messages for brukere

### Performance
- [ ] Implementere React Server Components der mulig
- [ ] Optimalisere bildestørrelser og lazy loading
- [ ] Database query optimization (indexer er allerede på plass)
- [ ] Implementere caching-strategi for statisk innhold
- [ ] Lighthouse score > 90 på alle sider

---

## Fase 3: Brukeropplevelse og konvertering (2-4 uker)
**Prioritet**: Høy

### UX-forbedringer
- [ ] A/B testing rammeverk for å teste ulike versjoner
- [ ] Forbedre onboarding for nye tilbydere
- [ ] Hjelpetekster og tooltips i matching-flyten
- [ ] Progressiv visning av resultater (infinite scroll)
- [ ] Bedre mobilopplevelse med native-lignende interaksjoner

### Søk og filtrering
- [ ] Avansert søk med flere filtre samtidig
- [ ] Lagre søk for innloggede brukere
- [ ] Søkehistorikk
- [ ] "Favoritter" for tjenester
- [ ] Sammenligne tjenester side-ved-side

### Anbefalinger
- [ ] Forbedre anbefalt-algoritme med maskinlæring
- [ ] "Andre brukere likte også"-funksjonalitet
- [ ] Personaliserte e-post-anbefalinger (ukentlig/månedlig)
- [ ] Push-notifikasjoner for nye tilbud i området

---

## Fase 4: Innholdsutvidelse (3-5 uker)
**Prioritet**: Middels-høy

### Vurderinger og reviews
- [ ] Komplett vurderingssystem for tjenester
- [ ] Verifiserte vurderinger (kun fra ekte bookinger)
- [ ] Bildeopplasting i vurderinger
- [ ] Moderering av vurderinger (admin-panel)
- [ ] Svar fra tilbydere på vurderinger

### Innholdstyper
- [ ] Blogg/artikler om trening og helse
- [ ] Treningsvideoer og guider
- [ ] Ekspertråd fra tilbydere
- [ ] Suksesshistorier fra brukere
- [ ] SEO-optimaliserte landingssider per by/kategori

### Tilbyder-funksjoner
- [ ] Kalenderintegrasjon (Google Calendar, Outlook)
- [ ] Automatisk booking-bekreftelse
- [ ] Klasse/gruppetime-administrasjon
- [ ] Medlemshåndtering for sentere
- [ ] Fakturamodul

---

## Fase 5: Skalering og datakvalitet (4-6 uker)
**Prioritet**: Middels

### Database-utvidelse
- [ ] Automatisk import fra Brønnøysundregisteret
  - [ ] API-integrasjon med Enhetsregisteret
  - [ ] Filtrering på NACE-koder (helse/fitness-relatert)
  - [ ] Automatisk kategorisering av virksomheter
  - [ ] Oppdatering av kontaktinformasjon
- [ ] Datavalidering og cleaning-pipeline
- [ ] Dublett-deteksjon og fusjonering
- [ ] Manuell verifikasjon av nye oppføringer

### Analytics og innsikt
- [ ] Detaljert analytics dashboard for tilbydere
- [ ] Konverteringsstatistikk (visninger → leads → bookinger)
- [ ] Markedsinnsikt (populære kategorier, priser, etc.)
- [ ] Eksport av data til CSV/Excel
- [ ] Google Analytics 4-integrasjon

### SEO og synlighet
- [ ] Strukturert data (Schema.org markup)
- [ ] Sitemap-generering
- [ ] Open Graph-metadata for alle sider
- [ ] Canonical URLs
- [ ] robots.txt optimalisering
- [ ] Lokal SEO for byer

---

## Fase 6: Markedsplassfunksjoner (5-8 uker)
**Prioritet**: Lav-middels

### Betalinger og transaksjoner
- [ ] Direkte betaling via plattformen (ikke bare leads)
- [ ] Stripe Connect for tilbydere
- [ ] Refusjonshåndtering
- [ ] Månedlige abonnementer
- [ ] Gavekort-funksjonalitet

### Kommunikasjon
- [ ] In-app chat mellom brukere og tilbydere
- [ ] Videochat-integrasjon for online-trenere
- [ ] E-post-notifikasjoner med templates
- [ ] SMS-notifikasjoner (via Twilio)
- [ ] Kalenderinvitasjoner (.ics-filer)

### Partnerskap
- [ ] Partner API for bedrifter (velferdstilbud)
- [ ] Hvitemerking for bedriftskunder
- [ ] Bulk-booking for organisasjoner
- [ ] Rapportering for HR-avdelinger

---

## Fase 7: AI og automatisering (Kontinuerlig)
**Prioritet**: Lav-middels

### AI-funksjoner
- [ ] AI-drevet matching (trene modell på historiske data)
- [ ] Chatbot for kundesupport
- [ ] Automatisk kategorisering av tilbydere
- [ ] Bildegenkjenning for profiler/fasiliteter
- [ ] Prediktiv analytics (churn, konvertering)

### Automatisering
- [ ] Automatisk påminnelser før avtaler
- [ ] Automatisk oppfølging av leads
- [ ] Automatisk prissetting basert på marked
- [ ] Automatisk kvalitetskontroll av profiler

---

## Kontinuerlige forbedringer

### Sikkerhet
- [ ] Penetrasjonstesting
- [ ] GDPR-compliance audit
- [ ] Sikker datasletting (anonymisering)
- [ ] 2FA for tilbydere og admin
- [ ] Rate limiting på alle API-endepunkter

### Infrastruktur
- [ ] CI/CD pipeline med automatisk testing
- [ ] Staging environment
- [ ] Database-backup rutiner
- [ ] Disaster recovery plan
- [ ] Horisontalt skalering (flere servere)

### Dokumentasjon
- [ ] API-dokumentasjon (OpenAPI/Swagger)
- [ ] Utviklerdokumentasjon
- [ ] Brukermanual for tilbydere
- [ ] Admin-guide

---

## Metrikksporing

### Nøkkeltall å måle:
- **Brukermetrikker**:
  - Antall søk per uke
  - Konverteringsrate (søk → lead)
  - Gjennomsnittlig tid i matching-flyt
  - Bounce rate på resultatsiden

- **Tilbydermetrikker**:
  - Antall aktive tilbydere
  - Gjennomsnittlig responstid på leads
  - Profil-fullstendighet
  - Antall bookinger per tilbyder

- **Tekniske metrikker**:
  - Response time for API-kall
  - Database query performance
  - Error rate
  - Uptime (mål: 99.9%)

---

## Risikoer og utfordringer

1. **Datakvalitet**: Mange tilbydere har ikke oppdatert informasjon i offentlige registre
   - *Løsning*: Manuell verifikasjon, insentiver for tilbydere å oppdatere selv

2. **Konkurranse**: Eksisterende aktører som Holdbar, Treningsappen, etc.
   - *Løsning*: Fokus på matching-kvalitet og lokal tilstedeværelse

3. **Cold start problem**: Få tilbydere = få brukere = få tilbydere
   - *Løsning*: Starte med ett geografisk område (f.eks. Oslo), bygge opp organisk

4. **Skalering**: PostgreSQL med PostGIS kan bli treg ved mange millioner rader
   - *Løsning*: Optimalisering av indekser, eventuelt Elasticsearch for søk

5. **Betalingsvilje**: Vil tilbydere betale for plattformen?
   - *Løsning*: Freemium-modell, betaling kun ved leads/bookinger

---

## Estimert total utviklingstid
- **Fase 2-3**: 4-7 uker
- **Fase 4-5**: 7-11 uker
- **Fase 6-7**: 5-8 uker (lavere prioritet)

**Total**: 16-26 uker for full funksjonalitet (avhengig av teamstørrelse og prioriteringer)
