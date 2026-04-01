#!/usr/bin/env tsx
/**
 * Push gruppetimer, yoga, outdoor, bootcamp og løpegrupper
 * fra data/group-fitness.jsonl til Supabase
 *
 * Upserts:
 *   - services
 *   - service_coverage (city-basert)
 *   - service_types
 *
 * Usage:
 *   npx tsx scripts/push-group-fitness.ts
 *   npx tsx scripts/push-group-fitness.ts --dry-run
 *   npx tsx scripts/push-group-fitness.ts --category=yoga
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
const dryRun         = args.includes('--dry-run');
const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1]?.toLowerCase() ?? null;

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ?? '';

const inFile = join(process.cwd(), 'data', 'group-fitness.jsonl');

// ── Helpers ───────────────────────────────────────────────────────────────
function makeId(category: string, term: string, address: string): string {
  return 'gf_' + `${category}_${term}_${address}`
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 78);
}

function extractCity(address: string): string | null {
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
interface GroupFitnessPlace {
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  category: string | null;
}

interface GroupFitnessRecord {
  category: string;
  term: string;
  query: string;
  city_searched: string;
  type: string;
  mainCategory: string;
  tags: string[];
  goals: string[];
  venues: string[];
  priceLevel: string;
  places: GroupFitnessPlace[];
  error?: string;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏃  SettDegEtMål – push group fitness til Supabase');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres]');
  console.log();

  if (!SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler');
    process.exit(1);
  }

  let rawLines: string[];
  try {
    rawLines = readFileSync(inFile, 'utf-8').split('\n').filter(Boolean);
  } catch {
    console.error(`❌ Finner ikke ${inFile}`);
    console.error('   Kjør først: npm run groups:find');
    process.exit(1);
  }

  const allRecords: GroupFitnessRecord[] = rawLines
    .map(l => JSON.parse(l) as GroupFitnessRecord)
    .filter(r => !r.error && r.places && r.places.length > 0);

  const records = categoryFilter
    ? allRecords.filter(r => r.category === categoryFilter)
    : allRecords;

  console.log(`📂 ${rawLines.length} linjer lest fra ${inFile}`);
  console.log(`   ${allRecords.length} med steder`);
  if (categoryFilter) console.log(`   Filtrerer til kategori: ${categoryFilter} (${records.length} oppføringer)`);
  console.log();

  if (records.length === 0) {
    console.log('Ingen oppføringer å prosessere.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const seenIds = new Set<string>();
  let totalServices = 0;
  let totalDuplicates = 0;
  let totalSkipped = 0;
  let totalCoverage = 0;
  let totalTypes = 0;
  let errors = 0;

  for (const record of records) {
    const validPlaces = record.places.filter(p => isNorwegianAddress(p.address));
    totalSkipped += record.places.length - validPlaces.length;

    for (const place of validPlaces) {
      const id = makeId(record.category, record.term, place.address);

      if (seenIds.has(id)) {
        totalDuplicates++;
        continue;
      }
      seenIds.add(id);

      const city = extractCity(place.address);
      const effectiveCity = city ?? record.city_searched;
      const cityDisplay = effectiveCity.charAt(0).toUpperCase() + effectiveCity.slice(1);

      const categoryLabel: Record<string, string> = {
        gruppetime:  'Gruppetime',
        yoga:        'Yoga',
        outdoor:     'Utendørs trening',
        bootcamp:    'Bootcamp',
        løpegruppe:  'Løpegruppe',
      };
      const catLabel = categoryLabel[record.category] ?? record.category;

      const serviceRow = {
        id,
        name: place.name,
        type: record.type,
        main_category: record.mainCategory,
        description: `${catLabel} i ${cityDisplay}`,
        address: place.address,
        city: effectiveCity,
        phone: place.phone ?? null,
        website: place.website ?? null,
        rating_avg: place.rating ?? 0,
        rating_count: 0,
        is_active: true,
        tags: record.tags,
        goals: record.goals,
        venues: record.venues,
        coverage: [],
        price_level: record.priceLevel,
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

      if (place.lat && place.lon && !dryRun) {
        await supabase
          .from('services')
          .update({ base_location: `SRID=4326;POINT(${place.lon} ${place.lat})` })
          .eq('id', id);
      }

      if (!dryRun) {
        await supabase.from('service_coverage').delete().eq('service_id', id);
        const { error: covErr } = await supabase
          .from('service_coverage')
          .insert([{ service_id: id, type: 'city', city: effectiveCity }]);
        if (covErr) {
          console.error(`\n     ✗ coverage ${id}: ${covErr.message}`);
          errors++;
        }
      }
      totalCoverage++;

      const typeRows = [{ service_id: id, type: record.type, is_primary: true }];
      if (!dryRun) {
        await supabase
          .from('service_types')
          .upsert(typeRows, { onConflict: 'service_id,type', ignoreDuplicates: true });
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
}

main().catch(err => {
  console.error('\n❌ Uventet feil:', err);
  process.exit(1);
});
