#!/usr/bin/env tsx
/**
 * Push gym chain locations from data/gym-chains.jsonl to Supabase
 *
 * Leser output fra scripts/find-gym-locations.ts og upserts:
 *   - services (name, address, type, phone, website, ...)
 *   - service_coverage (city-basert + region='norway')
 *   - service_types (mange-til-mange)
 *
 * Bruker whitelist (CHAIN_TYPE_MAP) – bare kjente treningssenterkjeder inklud.
 *
 * Usage:
 *   npx tsx scripts/push-gym-locations.ts
 *   npx tsx scripts/push-gym-locations.ts --dry-run
 *   npx tsx scripts/push-gym-locations.ts --chain=SATS
 */

import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local ───────────────────────────────────────────────────────
function loadEnv() {
  try {
    const text = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* no .env.local */ }
}
loadEnv();

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun     = args.includes('--dry-run');
const chainFilter = args.find(a => a.startsWith('--chain='))?.split('=')[1]?.toLowerCase() ?? null;

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ?? '';

const inFile = join(process.cwd(), 'data', 'gym-chains.jsonl');

// ── Whitelist: chain name (lowercase) → service types ────────────────────
// Only chains listed here are pushed to Supabase.
// Primary type = first in array → stored in services.type
const CHAIN_TYPE_MAP: Record<string, string[]> = {
  'sats':                      ['styrke', 'kondisjon', 'gruppe'],
  'evo fitness':               ['styrke', 'kondisjon'],
  'fresh fitness':             ['styrke', 'kondisjon'],
  'elixia':                    ['styrke', 'kondisjon', 'gruppe'],
  'treningshelse':             ['styrke', 'kondisjon'],
  'friskhuset':                ['styrke', 'gruppe'],
  'friskis & svettis':         ['gruppe', 'kondisjon'],
  'friskis svettis':           ['gruppe', 'kondisjon'],
  'friskis':                   ['gruppe', 'kondisjon'],
  'puls treningssenter':       ['styrke', 'gruppe'],
  'club de sport':             ['styrke', 'gruppe'],
  'sky fitness':               ['styrke', 'kondisjon'],
  'tt trening':                ['styrke'],
  'oslo athletica':            ['styrke'],
  'stamina':                   ['spesialisert', 'styrke'],
  'family trening':            ['styrke', 'gruppe'],
  'maxform':                   ['styrke'],
  'energy':                    ['styrke', 'kondisjon'],
  'just padel x':              ['sport'],
  'pro padel frekhaug':        ['sport'],
  'oslo pt':                   ['pt'],
  'medisinsk yoga':            ['yoga', 'mindbody'],
  'berntsen yoga':             ['yoga'],
  'in shape':                  ['styrke'],
  'crossfit elverum':          ['styrke'],
  'nordic fitness':            ['styrke', 'kondisjon'],
  'aktiv 365':                 ['styrke', 'kondisjon'],
  'vulkan arena':              ['styrke'],
  'xperience fitness':         ['styrke', 'kondisjon'],
  'vitality':                  ['livsstil', 'mindbody'],
  'fit4less':                  ['styrke', 'kondisjon'],
  'vip-clinique bærum':        ['spesialisert'],
};

// ── Helpers ───────────────────────────────────────────────────────────────
function makeId(chain: string, address: string): string {
  return 'gp_' + `${chain}_${address}`
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function extractCity(address: string): string | null {
  // "Akersgata 51, 0180 Oslo" → "oslo"
  const parts = address.split(',');
  const last = parts[parts.length - 1].trim();
  const match = last.match(/^\d{4}\s+(.+)$/);
  if (match) return match[1].trim().toLowerCase();
  // Sometimes no postal code prefix — just return last segment if short enough
  if (last.length > 2 && last.length < 40) return last.toLowerCase();
  return null;
}

function isNorwegianAddress(address: string): boolean {
  if (!address || address.trim().length < 5) return false;
  // Must contain a 4-digit Norwegian postal code
  if (!/\b\d{4}\b/.test(address)) return false;
  // Reject obvious non-Norwegian place names
  if (/india|new delhi|stockholm|sweden|denmark|finland|berlin|london|paris/i.test(address)) return false;
  return true;
}

function chainKeyFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-zæøå0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Types ─────────────────────────────────────────────────────────────────
interface GymPlace {
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  category: string | null;
}

interface GymChainRecord {
  chain: string;
  chain_key: string;
  places: GymPlace[];
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏋️  SettDegEtMål – push treningssenter-lokasjoner til Supabase');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  console.log();

  if (!SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler');
    process.exit(1);
  }

  // Load JSONL
  let rawLines: string[];
  try {
    rawLines = readFileSync(inFile, 'utf-8').split('\n').filter(Boolean);
  } catch {
    console.error(`❌ Finner ikke ${inFile}`);
    console.error('   Kjør først: npm run gyms:find-locations');
    process.exit(1);
  }

  const records: GymChainRecord[] = rawLines
    .map(l => JSON.parse(l) as GymChainRecord)
    .filter(r => r.places && r.places.length > 0);

  console.log(`📂 ${records.length} kjeder med treff i ${inFile}`);

  // Filter to whitelisted chains — exact first-word match required
  const toProcess = records.filter(r => {
    const key = chainKeyFromName(r.chain);
    if (chainFilter && !key.includes(chainFilter)) return false;
    return Object.keys(CHAIN_TYPE_MAP).some(wlKey => {
      // The chain key must start with the whitelist key, or vice versa —
      // but first word must match exactly (prevents "nord-odal" matching "nordic fitness")
      const chainFirst = key.split(' ')[0];
      const wlFirst    = wlKey.split(' ')[0];
      if (chainFirst !== wlFirst) return false;
      return key.startsWith(wlKey) || wlKey.startsWith(key);
    });
  });

  console.log(`   ${toProcess.length} kjeder etter whitelist-filter`);
  console.log();

  if (toProcess.length === 0) {
    console.log('Ingen kjeder å prosessere. Sjekk CHAIN_TYPE_MAP eller --chain filter.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let totalServices = 0;
  let totalSkipped = 0;
  let totalCoverage = 0;
  let totalTypes = 0;
  let errors = 0;

  for (const record of toProcess) {
    const chainKey = chainKeyFromName(record.chain);
    const types = Object.entries(CHAIN_TYPE_MAP).find(([k]) =>
      chainKey.startsWith(k) || k.startsWith(chainKey.split(' ')[0])
    )?.[1] ?? ['styrke'];

    const primaryType = types[0];

    // Filter to Norwegian addresses only
    const validPlaces = record.places.filter(p => isNorwegianAddress(p.address));
    const skipped = record.places.length - validPlaces.length;
    totalSkipped += skipped;

    if (validPlaces.length === 0) {
      console.log(`   ⚠  ${record.chain}: ingen norske adresser`);
      continue;
    }

    console.log(`   ${record.chain} (${validPlaces.length} steder, type: ${types.join(', ')})`);

    for (const place of validPlaces) {
      const id = makeId(record.chain, place.address);
      const city = extractCity(place.address);

      // Build service record
      const cityDisplay = city ? city.charAt(0).toUpperCase() + city.slice(1) : 'Norge';
      const serviceRow = {
        id,
        name: place.name || record.chain,
        type: primaryType,
        description: `${record.chain} – ${cityDisplay}`,
        address: place.address,
        city: city ?? null,
        phone: place.phone ?? null,
        website: place.website ?? null,
        rating_avg: place.rating ?? 0,
        rating_count: 0,
        is_active: true,
        tags: [record.chain.toLowerCase(), primaryType],
        goals: [],
        venues: ['gym'],
        coverage: [],
        price_level: 'medium',
        owner_user_id: null,
      };

      if (!dryRun) {
        const { error } = await supabase
          .from('services')
          .upsert(serviceRow, { onConflict: 'id', ignoreDuplicates: false });
        if (error) {
          console.error(`     ✗ service upsert: ${error.message}`);
          errors++;
          continue;
        }
      }
      totalServices++;

      // Coverage rows: city-based for physical locations, region='norway' only if no city found
      const coverageRows: object[] = [];
      if (city) {
        coverageRows.push({ service_id: id, type: 'city', city });
      } else {
        // No city → can't place locally, fall back to nationwide
        coverageRows.push({ service_id: id, type: 'region', region: 'norway' });
      }

      if (!dryRun) {
        // Delete old coverage for this service, re-insert
        await supabase.from('service_coverage').delete().eq('service_id', id);
        const { error: covErr } = await supabase.from('service_coverage').insert(coverageRows);
        if (covErr) {
          console.error(`     ✗ coverage: ${covErr.message}`);
          errors++;
        }
      }
      totalCoverage += coverageRows.length;

      // service_types rows
      const typeRows = types.map((t, idx) => ({
        service_id: id,
        type: t,
        is_primary: idx === 0,
      }));

      if (!dryRun) {
        const { error: typeErr } = await supabase
          .from('service_types')
          .upsert(typeRows, { onConflict: 'service_id,type', ignoreDuplicates: true });
        if (typeErr) {
          console.error(`     ✗ service_types: ${typeErr.message}`);
          errors++;
        }
      }
      totalTypes += typeRows.length;
    }
  }

  console.log();
  console.log('✅ Ferdig!');
  console.log(`   Services upsert  : ${totalServices}`);
  console.log(`   Coverage-rader   : ${totalCoverage}`);
  console.log(`   Type-rader       : ${totalTypes}`);
  if (totalSkipped > 0) console.log(`   Hoppet over      : ${totalSkipped} (utenlandske/manglende adresser)`);
  if (errors > 0) console.log(`   Feil             : ${errors}`);
  if (dryRun) console.log('\n   (Ingen endringer lagret – kjør uten --dry-run for å lagre)');

  // After push, we need to update base_location from address for radius search to work.
  // Run the SQL below in Supabase SQL editor:
  if (!dryRun && totalServices > 0) {
    console.log();
    console.log('📍 Neste steg – oppdater base_location for nye services:');
    console.log('   Kjør i Supabase SQL editor:');
    console.log(`
   UPDATE services s
   SET base_location = ST_SetSRID(
     ST_MakePoint(sc.lon::double precision, sc.lat::double precision), 4326
   )
   FROM (
     SELECT service_id,
       split_part(address_coords, ',', 2)::double precision AS lat,
       split_part(address_coords, ',', 1)::double precision AS lon
     FROM (
       SELECT id AS service_id, NULL AS address_coords FROM services WHERE id LIKE 'gp_%'
     ) t
   ) sc
   WHERE s.id = sc.service_id;
    `);
    console.log('   (Krever at lat/lon er tilgjengelig — se scripts/geocode-entities.ts)');
  }
}

main().catch(err => {
  console.error('\n❌ Uventet feil:', err);
  process.exit(1);
});
