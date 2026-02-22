# Launch checklist

## Tekniske sjekker
- ENV satt: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- Stripe: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET (hvis ENABLE_PAYMENTS=true)
- Resend: RESEND_API_KEY, RESEND_FROM_EMAIL (hvis ENABLE_EMAILS=true)
- NEXT_PUBLIC_APP_URL peker til produksjonsdomene
- RLS aktivert og testet for services, leads, lead_messages, reviews, events

## Juridisk
- /personvern publisert og gjennomlest
- /vilkar publisert og gjennomlest
- /cookies publisert og gjennomlest
- Samtykke-flyt testet for nye brukere

## Admin
- ADMIN_EMAIL satt og testet
- ENABLE_ADMIN=true kun for intern drift
- Admin kan deaktivere tjenester og se feil/metrics

## Backup / eksport
- Supabase backup plan verifisert
- Dataeksport via Min side testet
- Sletteflyt testet og logg verifisert

## Go/No-Go
- ENABLE_PAYMENTS=true kun hvis Stripe er satt opp og testet
- ENABLE_EMAILS=true kun hvis Resend er satt opp og testet
- ENABLE_REVIEWS=true kun hvis reviews-tabellen er klar

## Nodsituasjon
- Sett ENABLE_PAYMENTS=false for aa stoppe nye leads
- Sett ENABLE_EMAILS=false for aa stoppe e-post
- Sett ENABLE_ADMIN=false for aa skjule admin-panelet
- Sett services.is_active=false for aa deaktivere enkelt-tilbydere

