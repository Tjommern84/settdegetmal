# Partner API (lukket)

Dette dokumentet beskriver den interne partner-APIen for settdegetmal.no. APIet er ikke offentlig, og kun tilgjengelig for avtalte samarbeidspartnere.

## Tilgjengelige endepunkter

- GET /api/partner/services
  - Felter: id, name, type, coverage (forenklet), goals, rating_avg
  - Ingen personopplysninger, leads eller kontaktdata

## Autentisering

- Krever header: x-partner-key
- Nøkkel deles kun via avtale

## Rate limit

- 100 forespørsler per time per partner-nøkkel

## Kontakt

- Teknisk kontakt: tech@settdegetmal.no
- Produktkontakt: partner@settdegetmal.no

## Viktig

Dette er ikke et offentlig API. Tilgang kan endres eller stenges uten varsel dersom retningslinjer brytes.
