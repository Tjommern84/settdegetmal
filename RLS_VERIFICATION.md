# RLS Verification Guide

## Oversikt

Denne guiden brukes for å verifisere at Row Level Security (RLS) er korrekt konfigurert for alle sensitive tabeller i settdegetmal.no.

## Tabeller som krever RLS

| Tabell | Sensitivitet | RLS Fil |
|--------|-------------|---------|
| `services` | Middels | `sql/rls_policies.sql` |
| `leads` | Høy | `sql/rls_policies.sql` |
| `lead_messages` | Høy | `sql/rls_policies.sql` |
| `reviews` | Middels | `sql/rls_policies.sql` |
| `organizations` | Middels | `sql/rls_policies.sql` |
| `bookings` | Høy | `sql/bookings.sql` |
| `quality_events` | Lav | `sql/bookings.sql` |
| `user_preferences` | Middels | `sql/user_preferences.sql` |
| `app_errors` | Lav | `sql/rls_policies.sql` |
| `profiles` | Høy | `sql/rls_policies.sql` |

## Oppsett

### 1. Kjør RLS-skriptet

```sql
-- I Supabase SQL Editor, kjør:
-- sql/rls_policies.sql
```

### 2. Verifiser at RLS er aktivert

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'services', 'leads', 'lead_messages', 'reviews',
    'organizations', 'bookings', 'quality_events',
    'user_preferences', 'app_errors', 'profiles'
  );
```

**Forventet resultat:** Alle tabeller skal ha `rowsecurity = true`

### 3. List aktive policies

```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Manuell Verifikasjon (Test-matrise)

### Test-brukere

1. **Anon** - Ikke innlogget
2. **User A** - Vanlig bruker med egen lead
3. **User B** - Annen bruker (skal ikke se User A sine data)
4. **Provider** - Tilbyder som eier en tjeneste
5. **Admin** - Service role bruker

### Test-case per tabell

#### `services`

| Test | Rolle | Forventet |
|------|-------|-----------|
| SELECT aktiv tjeneste | Anon | ✅ Tillatt |
| SELECT inaktiv tjeneste | Anon | ❌ Blokkert |
| SELECT egen tjeneste (inaktiv) | Provider | ✅ Tillatt |
| UPDATE egen tjeneste | Provider | ✅ Tillatt |
| UPDATE andres tjeneste | Provider | ❌ Blokkert |

```sql
-- Test som anon:
SELECT * FROM services WHERE is_active = false; -- Skal returnere 0 rader
```

#### `leads`

| Test | Rolle | Forventet |
|------|-------|-----------|
| SELECT egne leads | User A | ✅ Tillatt |
| SELECT andres leads | User B | ❌ Blokkert |
| SELECT leads på egen tjeneste | Provider | ✅ Tillatt |
| INSERT ny lead | User | ✅ Tillatt |

```sql
-- Test som User B:
SELECT * FROM leads WHERE user_id != auth.uid(); -- Skal returnere 0 rader
```

#### `lead_messages`

| Test | Rolle | Forventet |
|------|-------|-----------|
| SELECT meldinger på egen lead | User | ✅ Tillatt |
| SELECT meldinger på andres lead | User | ❌ Blokkert |
| INSERT melding på egen lead | User | ✅ Tillatt |
| INSERT melding på andres lead | User | ❌ Blokkert |

#### `reviews`

| Test | Rolle | Forventet |
|------|-------|-----------|
| SELECT alle reviews | Anon | ✅ Tillatt |
| INSERT egen review | User | ✅ Tillatt |
| UPDATE egen review | User | ✅ Tillatt |
| UPDATE andres review | User | ❌ Blokkert |
| DELETE egen review | User | ✅ Tillatt |

#### `organizations`

| Test | Rolle | Forventet |
|------|-------|-----------|
| SELECT egen org | Member | ✅ Tillatt |
| SELECT andres org | User | ❌ Blokkert |
| UPDATE egen org | Admin member | ✅ Tillatt |
| UPDATE egen org | Regular member | ❌ Blokkert |

#### `app_errors`

| Test | Rolle | Forventet |
|------|-------|-----------|
| SELECT feil | User | ❌ Blokkert |
| SELECT feil | Service role | ✅ Tillatt |
| INSERT feil | User | ❌ Blokkert |
| INSERT feil | Service role | ✅ Tillatt |

## Automatisert Test-script

```typescript
// Test i Node.js med Supabase client

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, anonKey);

// Test 1: Anon can't see inactive services
const { data } = await supabase
  .from('services')
  .select('*')
  .eq('is_active', false);

console.assert(data?.length === 0, 'Anon should not see inactive services');

// Test 2: User can only see own leads
const { data: leads } = await supabase
  .from('leads')
  .select('*');

for (const lead of leads ?? []) {
  console.assert(
    lead.user_id === currentUserId,
    `User should only see own leads, found: ${lead.user_id}`
  );
}
```

## Feilsøking

### Policy ikke aktivert?

```sql
-- Sjekk om RLS er PÅ for tabellen:
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'tablename';

-- Aktiver manuelt:
ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;
```

### Policy fungerer ikke?

```sql
-- Se alle policies for en tabell:
SELECT * FROM pg_policies WHERE tablename = 'leads';

-- Test policy som spesifikk bruker:
SET request.jwt.claims TO '{"sub": "user-uuid-here"}';
SELECT * FROM leads;
RESET request.jwt.claims;
```

### Bypass for admin?

Service role key bypasser automatisk RLS. Verifiser at:
- Frontend ALDRI bruker service role key
- Service role key kun brukes i server actions med `getServiceSupabase()`

## Signatur

- [ ] RLS aktivert på alle tabeller
- [ ] Policies kjørt fra `sql/rls_policies.sql`
- [ ] Manuelt testet med 3+ roller
- [ ] Dokumentert i denne filen

**Verifisert av:** ___________________
**Dato:** ___________________
