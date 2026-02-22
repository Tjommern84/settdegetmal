# TECH_NOTES

## Arkitekturkort
- **Frontend:** Next.js App Router with server components where possible, interactive flows kept in small client boundaries (`ResultsView`, `ProviderClient`, form actions). Styling uses Tailwind/Tailwind config and shared `components/ui/*` primitives.
- **Backend:** Supabase (anon key on client, service role for admin/critical flows) plus Stripe/StripeB2B for checkout, Resend/email templates, and server actions wrapped with `lib/errorLogger.ts` to capture failures safely.
- **Database:** Postgres via Supabase; heavy tables (`services`, `leads`, `reviews`, `events`, organizations) now documented in `sql/indexes.sql` to keep read paths performant, especially for matching, dashboards, and admin exports.

## Kritiske beslutninger
1. The results route now fetches active services on the server (limit 500), ranks them centrally, and streams only the rendered data to the client so client bundles remain lightweight and consistent; fallback data from `lib/providers.ts` ensures the page renders even without Supabase.
2. Provider profiles reuse the same server-fetched service data for metadata/rendering rather than re-querying inside the client component, reducing duplicate fetches and making invalid/missing IDs easier to handle.
3. Server actions across leads, reviews, claims, payments, and admin paths keep returning structured `{ ok, message }` responses, log errors via `wrapServerAction`, and avoid exposing sensitive payloads while still surfacing actionable errors.

## Kjente begrensninger
- Supabase calls on the results page are limited to the first 500 active services (`limit(500)`); if your catalog grows beyond that, adjust the query or implement pagination (the SQL indexes can help keep it fast).
- When Supabase isn't configured the UI uses the static provider list located in `lib/providers.ts`, so live data/matching may lag until the service key is supplied.
- Sorting/filters immediately navigate (via `router.replace`) rather than performing optimistic client-side ranking, so each change refetches the server-rendered data.

## Geokoding og autofullføring
- Geokoding caches in the `locations` table (`sql/locations.sql`) to avoid hitting Nominatim on every search; `/api/geocode` reads from the cache first, rate-limits per IP (30/min) and only stores up to five rows per query from Nominatim with a proper User-Agent header.
- The wizard location field now calls `/api/geocode`, stores the canonical label + lat/lon in state (`app/flyt/page.tsx`), and pushes those parameters to `/resultater` so downstream matching uses precise coordinates.
- Results (and SEO landing pages) use the cached lat/lon when available to drive the PostGIS search (`lib/matchingDb.ts` → `search_services` RPC) and to display “Resultater nær {locationLabel}”; fallback to hard-coded city coordinates stays in place when geocoding data is missing.

## Matching og coverage
- Search now runs in PostGIS via the `search_services` RPC (see `sql/postgis_matching.sql`) which uses `service_coverage`, spatial indexes, and the same score/reason weights as the legacy JS logic; DB fallback occurs only when the RPC fails.
- Coverage data is normalized into `service_coverage` (radius/city/region rows) but we keep `services.coverage` for legacy reads; updates to coverage also refresh the normalized table in `app/dashboard/actions.ts::updateServiceProfile`.

## Hvis noe ryker i prod – gjør dette først
1. Verify `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (for admin) `SUPABASE_SERVICE_ROLE_KEY`; without them the site reverts to static fallbacks and server actions silently return configuration errors.
2. Check `app_errors` via the admin dashboard or the `sql/indexes.sql` indexes to ensure the new indexes exist; missing indexes can show up as slow matching/dashboards.
3. Confirm recent deployments did not break `app/resultater` or `app/tilbyder/[id]` by reproducing a search and a provider lookup locally; if those fail, inspect `TECH_NOTES` + `sql/indexes.sql`.

## Caching improvements (UTGAVE 4.3)
- search_cache + service_cache tables keep recent search and provider payloads (TTL 5 min) while Next cache buckets identical queries so matching calls reuse warm results before the DB cache.
- invalidateServiceCaches now clears both caches when a service profile changes, activation toggles, or a new review arrives, keeping stale data out of production.
- /trening/[by]/[goal] revalidates hourly and /tilbyder/[id] every 5 minutes; /resultater stays dynamic but reuses the cached search workflow with per-query buckets and logging for hits/misses.
