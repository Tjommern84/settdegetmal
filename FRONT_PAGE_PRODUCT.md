# Forsideprodukt for SettDegEtMål

Denne dokumentasjonen beskriver et komplett produktforløp for forsiden slik den bør oppleves i SettDegEtMål: én destinasjon der mål, sted og treningsform smelter sammen i en brukerflyt med både søk, visualisering og innsiktsdrivende seksjoner.

## 1. Overordnet mål
Forsiden skal gjøre tre ting umiddelbart:
1. Gi brukeren trygghet på at tjenesten kjenner lokale trenings- og helseaktører.
2. La brukeren kombinere mål, budsjett og sted med få klikk og få navigert til relevante tjenester.
3. Synliggjøre rikheten i tilbudet – alternativer for studio, digitalt, grupper og mantel rundt den enkelte tjenesten (rating, tilgjengelighet, prisnivå mv.).

## 2. Helhetlig layout og interaksjon
### 2.1 Black box: Brukerens inngangspunkter
- **Hero-felt** med fullbredde gradient/video og en hero-tittel: "Finn trening som passer deg – nær deg, hjemme eller digitalt".
- En sekundær forklaring: "Velg mål, preferanse og område. Vi matcher deg med kvalitetstilbydere i din postnummerregion."
- **Søkemodul** plassert i midten av hero-seksjonen (eller i et opphøyd kort):
  - Input for lokasjon med auto-komplett basert på `locations`/postnummer.
  - Målpanel: visuelle chips med mål som "Styrke", "Utholdenhet", "Mobilitet", "Rehab"; brukeren kan velge flere. Data kobles mot `goals`-arrayen i `services`.
  - Typemodul: dropdown eller tilpassede knapper for "Treningssenter", "PT", "Bevegelse & balanse", "Hjemmetrening", "Idrettsforening" og «Flere kategorier».
  - Budsjettvelger med radioknapper: "Lav", "Medium", "Høy".
  - CTA-knapp "Finn tjenester" som kjører `search_services` med valgte filtre.
- Under søkemodulen ligger en “fmt”-sone med fire kort (4-delt firkant) som fremhever hovedkategorier. Hvert kort inneholder:
  - Ikon/illustrasjon.
  - Kort overskrift.
  - 1–2 linjer forklaring (konkret kundeverdi).
  - Daglig oppdatert data (antall tjenester i region, gjennomsnittlig rating, siste booking). Data hentes via `service_location_overview`-view som kombinerer `services` og `postal_regions`.

### 2.2 Hovedkategorier (utvidet)
Arranger en modul med kort for hvert av følgende segmenter. Kortene skal følge designet (ikon, bakgrunnsfarge, CTA) og linke direkte til prefiltrerte søk.
1. **Treningssenter & studioer** – fokus på lokale senter, tilgjengelige timer, drop-in og fasiliteter.
2. **Personlig trener (PT)** – kvalitet (rating, erfaring), tilgjengelighet, digital/physical sessions. CTA: "Se ledige timer".
3. **Bevegelse & balanse** – det nye navnet for yoga/stretch/avspenning. Betegn det som "Bevegelse & balanse" for å kommunisere et målrettet tilbud for mobilitet og mental restitusjon.
4. **Hjemmetrening & digital coaching** – live streaming, on-demand-program, utstyr-sett med levering. CTA: "Start en digital økt".
5. **Idrettsforeninger & lag** – klubb-kapasitet, kontaktpersoner, familiesatsing.
6. **Kliniske tjenester & rehab** – fysioterapi, helsestudio, mental trening.
7. **Små grupper & nisjestudioer** – pilates, dans, kampsport, CrossFit-lignende konsepter.
8. **Barn & familie** – barneklasser, familiepakker, aktivitetstilbud for barn.
9. **Utendørs & natur** – turlag, løpegrupper, fjelltrening; suppler med kartvisning.
10. **Bedrift & corporate** – bedriftsavtaler, gruppebooking, kontor-yoga.
11. **Digital coaching & abonnement** – kombinerer app-baserte opplegg med check-ins.
12. **Høyytelse & spesialicerte mål** – olympisk trening, triatlon, konkurranseforberedelser.

Hvert kort bør også vise en “mini-stat” med antall tilbydere, tilgjengelige måter å booke på (online/in-person), og en kort testimonial/case for gruppen.

### 2.3 Geografisk & postnummer-sentrert modul
- Kart (Mini Map) eller gradientkart med fargekodede postnummerregioner, der datasettene fra `postal_regions` viser hvilke områder har flest tilgjengelige tjenester.
- “Velg postnummer” dropdown som fyller ut regionens navn og radius. Når en bruker klikker på kartet/det valgte postnummeret, oppdateres søkemodulen.
- Tekstforklaring: "Vi bruker Norges postnummeratlas – prefix NAV, 01–99 – for å gi deg presise regionale treff. Velg region – få riktige tjenester.".

### 2.4 Sosialt bevis og tillit
- Karusell/kort med brukeromtaler (fra `reviews`), med rating, kommentar og hvilken tjeneste som ble brukt.
- Banderole for “Anbefalte partnerbedrifter”, “Stripesertifisert betalingsflyt”, “GDPR + Supabase-authet”.

### 2.5 Partner-CTA og selgerfokus
- Sekvens for tilbydere: "Er du leverandør?" – forklar hvordan man registrerer service, legger til coverage (radius/postnummer) og bruker dashboards.
- Link til onboarding (Stripe, Resend, Supabase Auth).
- Notifikasjon om feature flags (Pilot, Admin, Partner API) der relevante tierer slipper nye funksjoner.

### 2.6 Footer / secondary actions
- “Hvor skal du herfra?” med sekundære CTA: “Sett opp varsler”, “Last opp virksomhet”, “Få vipps av tjenester”, “Se roadmap”.
- Kort fakta-kolonne med tekster “110+ tjenester i Oslo”, “50+ digitale coacher”, “Nyeste region: Kongsberg”.

## 3. Teknologi og datatilknytning
- Hver seksjon skal ha tydelige data-kilder:
  - `search_services` for resultatlisten.
  - `service_location_overview`–visning for antall tjenester per kategori per region.
  - `postal_regions` tabell for prefix-tilknytningen.
  - `reviews`, `leads`, `bookings` for testimonials og rating.
- Bruk `app/page.tsx` og tilhørende `ui`-komponenter (kort, kart, hero) for å komposere statiske moduler med server- og client-komponenter etter behov.
- UI-styling via Tailwind (moduler strukturert med `components/ui/card.tsx`, `components/ui/hero.tsx`).

## 4. Tilleggsidéer
1. **Publikumsspesifikke innganger** – “For deg som trener hjemme”, “For deg som er i rehabilitering”, med mikrolanding dedikert til disse use casene.
2. **Prestasjonstavle** – “Nye bookings i ditt område” / “Uker med ledig kapasitet” / “Se treningsmål i ditt team”.
3. **Innholdsdeling** – blogg/lit-innlegg, “ukeplan” etc. – lenker til `blog` (ny modul under `app/` eller `public/`).
4. **Live data strips** – “Nye tilbud denne uken”, “Mer enn 2 000 bookinger i Q1” (kan vises via `events`-tabellen).

## 5. Hva er neste steg
1. Validér hvilke data som allerede finnes i `services`, `service_coverage`, `postal_regions` (og nye tabeller) for hver kategori.
2. Skisser Next.js-wireframe for hero + kategori-moduler og implementer modulene under `app/page.tsx` og `components/ui/`.
3. Seed `postal_regions` og tilknytt `services` for å få ekte tall på “antall tjenester pr. region” som vises på forsiden.
4. Legg til A/B-test av kategorikortene (vil en bruker foretrekke “Treningssenter + PT” vs. “Bevegelse & balanse + digital?”). 

Dokumentet kan legges til repo som referanse for videre design- og produktmøter. Vil du også at jeg bygger komponentmaler eller et mockup-oppsett basert på dette?
