#!/usr/bin/env tsx
/**
 * Push idrettslag og klubber fra data/sport-clubs.jsonl til Supabase
 *
 * Leser output fra scripts/find-sport-clubs.ts og upserts:
 *   - services (name, address, type='sport', phone, website, ...)
 *   - service_coverage (city-basert KUN — aldri region='norway')
 *   - service_types (mange-til-mange)
 *
 * Usage:
 *   npx tsx scripts/push-sport-clubs.ts
 *   npx tsx scripts/push-sport-clubs.ts --dry-run
 *   npx tsx scripts/push-sport-clubs.ts --sport=fotball
 */

import { readFileSync } from 'fs';
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
const sportFilter = args.find(a => a.startsWith('--sport='))?.split('=')[1]?.toLowerCase() ?? null;

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ?? '';

const inFile = join(process.cwd(), 'data', 'sport-clubs.jsonl');

// ── Helpers ───────────────────────────────────────────────────────────────
function makeId(sport: string, address: string): string {
  return 'sc_' + `${sport}_${address}`
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function extractCity(address: string): string | null {
  // "Maridalsveien 87, 0461 Oslo" → "oslo"
  const parts = address.split(',');
  const last = parts[parts.length - 1].trim();
  const match = last.match(/^\d{4}\s+(.+)$/);
  if (match) return match[1].trim().toLowerCase();
  if (last.length > 2 && last.length < 40) return last.toLowerCase();
  return null;
}

function isNorwegianAddress(address: string): boolean {
  if (!address || address.trim().length < 5) return false;
  if (!/\b\d{4}\b/.test(address)) return false;
  if (/india|new delhi|stockholm|sweden|denmark|finland|berlin|london|paris/i.test(address)) return false;
  return true;
}

// ── Types ─────────────────────────────────────────────────────────────────
interface SportPlace {
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  category: string | null;
}

interface SportClubRecord {
  sport: string;
  query: string;
  city_searched: string;
  tags: string[];
  places: SportPlace[];
  error?: string;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('⚽  SettDegEtMål – push idrettslag til Supabase');
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
    console.error('   Kjør først: npm run clubs:find');
    process.exit(1);
  }

  const records: SportClubRecord[] = rawLines
    .map(l => JSON.parse(l) as SportClubRecord)
    .filter(r => !r.error && r.places && r.places.length > 0);

  console.log(`📂 ${rawLines.length} linjer lest fra ${inFile}`);
  console.log(`   ${records.length} med steder (${rawLines.length - records.length} uten treff/feil)`);

  // Apply sport filter
  const toProcess = sportFilter
    ? records.filter(r => r.sport === sportFilter)
    : records;

  if (sportFilter) console.log(`   Filtrerer til sport: ${sportFilter} (${toProcess.length} oppføringer)`);
  console.log();

  if (toProcess.length === 0) {
    console.log('Ingen oppføringer å prosessere.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Deduplicate by ID across all records in this run
  const seenIds = new Set<string>();
  let totalServices = 0;
  let totalSkipped = 0;
  let totalDuplicates = 0;
  let totalCoverage = 0;
  let totalTypes = 0;
  let errors = 0;

  for (const record of toProcess) {
    const validPlaces = record.places.filter(p => isNorwegianAddress(p.address));
    const skipped = record.places.length - validPlaces.length;
    totalSkipped += skipped;

    for (const place of validPlaces) {
      const id = makeId(record.sport, place.address);

      // Skip duplicates within this run (same place shows up in multiple city searches)
      if (seenIds.has(id)) {
        totalDuplicates++;
        continue;
      }
      seenIds.add(id);

      const city = extractCity(place.address);
      const cityDisplay = city ? city.charAt(0).toUpperCase() + city.slice(1) : record.city_searched;

      const serviceRow = {
        id,
        name: place.name,
        type: 'sport',
        description: `${record.tags[0] ? record.tags[0].charAt(0).toUpperCase() + record.tags[0].slice(1) : 'Idrettslag'} i ${cityDisplay}`,
        address: place.address,
        city: city ?? record.city_searched,
        phone: place.phone ?? null,
        website: place.website ?? null,
        rating_avg: place.rating ?? 0,
        rating_count: 0,
        is_active: true,
        tags: [...record.tags, 'idrettslag'],
        goals: ['endurance', 'strength', 'start'],
        venues: ['gym'],
        coverage: [],
        price_level: 'low',
        owner_user_id: null,
      };

      if (!dryRun) {
        const { error } = await supabase
          .from('services')
          .upsert(serviceRow, { onConflict: 'id', ignoreDuplicates: false });
        if (error) {
          console.error(`\n     ✗ service upsert ${id}: ${error.message}`);
          errors++;
          continue;
        }
      }
      totalServices++;

      // Coverage: city only — sports clubs are local, never nationwide
      const effectiveCity = city ?? record.city_searched;
      const coverageRows: object[] = [
        { service_id: id, type: 'city', city: effectiveCity },
      ];

      // Set base_location (PostGIS) if we have coordinates from Google Places
      if (place.lat && place.lon && !dryRun) {
        await supabase
          .from('services')
          .update({ base_location: `SRID=4326;POINT(${place.lon} ${place.lat})` })
          .eq('id', id);
      }

      if (!dryRun) {
        await supabase.from('service_coverage').delete().eq('service_id', id);
        const { error: covErr } = await supabase.from('service_coverage').insert(coverageRows);
        if (covErr) {
          console.error(`\n     ✗ coverage ${id}: ${covErr.message}`);
          errors++;
        }
      }
      totalCoverage += coverageRows.length;

      // service_types
      const typeRows = [{ service_id: id, type: 'sport', is_primary: true }];
      if (!dryRun) {
        const { error: typeErr } = await supabase
          .from('service_types')
          .upsert(typeRows, { onConflict: 'service_id,type', ignoreDuplicates: true });
        if (typeErr) {
          console.error(`\n     ✗ service_types ${id}: ${typeErr.message}`);
          errors++;
        }
      }
      totalTypes += typeRows.length;
    }
  }

  console.log('✅ Ferdig!');
  console.log(`   Services upsert  : ${totalServices}`);
  console.log(`   Duplikater hoppa : ${totalDuplicates}`);
  console.log(`   Coverage-rader   : ${totalCoverage}`);
  console.log(`   Type-rader       : ${totalTypes}`);
  if (totalSkipped > 0) console.log(`   Hoppet over      : ${totalSkipped} (utenlandske/manglende adresser)`);
  if (errors > 0) console.log(`   Feil             : ${errors}`);
  if (dryRun) console.log('\n   (Ingen endringer lagret – kjør uten --dry-run for å lagre)');

  if (!dryRun && totalServices > 0) {
    console.log();
    console.log('📍 Koordinater er satt der lat/lon var tilgjengelig fra Google Places.');
    console.log('   Sjekk resultater: /resultater?type=sport&location=Oslo');
  }
}

main().catch(err => {
  console.error('\n❌ Uventet feil:', err);
  process.exit(1);
});
