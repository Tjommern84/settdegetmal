#!/usr/bin/env tsx
/**
 * Finn treningssenter-kjeder og lokasjoner via Serper.dev (Google Search API)
 *
 * 1. Henter alle tjenester fra Supabase
 * 2. Grupperer etter kjedenavn (navn med 3+ innslag = kjede)
 * 3. Søker Google via Serper for hver kjede → henter adresser + koordinater
 * 4. Lagrer resultater i data/gym-chains.jsonl
 *
 * Krev: SERPER_API_KEY i .env.local
 * Gratis konto: https://serper.dev  (2500 gratis søk)
 *
 * Usage:
 *   npx tsx scripts/find-gym-locations.ts
 *   npx tsx scripts/find-gym-locations.ts --limit=20
 *   npx tsx scripts/find-gym-locations.ts --type=styrke
 *   npx tsx scripts/find-gym-locations.ts --min-count=2
 *   npx tsx scripts/find-gym-locations.ts --delay=2000
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
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
  } catch { /* .env.local not found, fall through */ }
}
loadEnv();

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitArg   = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]     ?? '0') || null;
const typeFilter = args.find(a => a.startsWith('--type='))?.split('=')[1]                ?? null;
const minCount   = parseInt(args.find(a => a.startsWith('--min-count='))?.split('=')[1] ?? '3');
const delayMs    = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1]     ?? '1500');

// ── Config ────────────────────────────────────────────────────────────────
const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
                    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                    ?? '';

const outDir  = join(process.cwd(), 'data');
const outFile = join(outDir, 'gym-chains.jsonl');
mkdirSync(outDir, { recursive: true });

// ── Types ─────────────────────────────────────────────────────────────────
interface ServiceRow {
  name: string;
  type: string;
  city: string | null;
  orgnr: string | null;
}

interface SerperPlace {
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
}

interface SerperOrganic {
  title: string;
  link: string;
  snippet: string;
}

interface SerperResponse {
  places?: SerperPlace[];
  organic?: SerperOrganic[];
  knowledgeGraph?: {
    title?: string;
    address?: string;
    phone?: string;
    website?: string;
    description?: string;
  };
}

// Generic words that should NOT be used as chain keys on their own
const GENERIC_WORDS = new Set([
  'personlig', 'trener', 'treningssenter', 'treningsstudio', 'fitness',
  'gym', 'senter', 'helsestudio', 'studio', 'club', 'sport', 'idrett',
  'helse', 'velvære', 'velvare', 'kropp', 'aktiv', 'trim', 'motion',
  'løping', 'svømming', 'dans', 'yoga', 'pilates', 'crossfit', 'pt',
  'online', 'digital', 'virtual', 'norge', 'norsk', 'nordic', 'as',
  'og', 'og', 'den', 'det', 'min', 'din', 'mitt', 'ditt',
]);

// ── Chain name normalization ───────────────────────────────────────────────
function extractBrandName(name: string): string {
  return name
    .replace(/\s+(AS|DA|ANS|BA|SA|NUF|IKS|KS|STI|BBL)\s*$/i, '')
    .replace(/\s+(treningssenter|treningsstudio|fitness|gym|senter|helsestudio|studio|club)\s*$/i, '')
    .replace(/\s+[–\-]\s+.+$/, '')   // "SATS – Oslo S" → "SATS"
    .replace(/\s+\d+$/, '')            // "Fresh Fitness 2" → "Fresh Fitness"
    .replace(/\s+(oslo|bergen|trondheim|stavanger|tromsø|drammen|fredrikstad|sandvika|storo|sentrum|vest|øst|nord|sør)(\s.*)?$/i, '')
    .trim();
}

function chainKey(name: string): string {
  const brand = extractBrandName(name);
  const words = brand
    .toLowerCase()
    .replace(/[^a-zæøå0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !GENERIC_WORDS.has(w));
  if (words.length === 0) return '';
  // Use first 2 meaningful words as key
  return words.slice(0, 2).join(' ');
}

// Known Norwegian gym chains — always included regardless of DB detection
const KNOWN_CHAINS = [
  'SATS', 'Evo Fitness', 'Fresh Fitness', 'Elixia', 'Treningshelse',
  'Friskis & Svettis', 'Aktiv 365', 'Vulkan Arena', 'Xperience Fitness',
  'Nordic Fitness', 'Friskhuset', 'Oslo Athletica', 'Puls Treningssenter',
  'Stamina', 'Vitality', 'MaxForm', 'Fit4Less', 'Club de Sport',
];

// ── Serper Places API ─────────────────────────────────────────────────────
interface SerperPlacesResult {
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  category?: string;
}

interface SerperPlacesResponse {
  places?: SerperPlacesResult[];
}

async function searchPlaces(query: string): Promise<SerperPlacesResult[]> {
  const res = await fetch('https://google.serper.dev/places', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'no',
      hl: 'no',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Serper HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json() as SerperPlacesResponse;
  return data.places ?? [];
}

// Keep old search type for organic results / knowledge graph fallback
async function searchSerper(query: string): Promise<SerperResponse | null> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'no',
      hl: 'no',
      num: 5,
    }),
  });

  if (!res.ok) return null;
  return res.json() as Promise<SerperResponse>;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏋️  SettDegEtMål – finn treningssenter-lokasjoner via Google');
  console.log();

  if (!SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY mangler i .env.local');
    console.error('');
    console.error('   1. Gå til https://serper.dev og opprett gratis konto');
    console.error('   2. Kopier API-nøkkelen');
    console.error('   3. Legg til i .env.local:');
    console.error('      SERPER_API_KEY=din-nøkkel-her');
    console.error('   4. Kjør scriptet på nytt');
    process.exit(1);
  }

  if (!SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler i .env.local');
    process.exit(1);
  }

  // 1. Hent tjenester fra Supabase (paginert – henter alle rader)
  console.log('📦 Henter tjenester fra Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Resolve type filter IDs first if needed
  let typeIds: string[] | null = null;
  if (typeFilter) {
    const { data } = await supabase
      .from('service_types')
      .select('service_id')
      .eq('type', typeFilter);
    typeIds = (data ?? []).map((r: { service_id: string }) => r.service_id);
  }

  const PAGE_SIZE = 1000;
  const services: ServiceRow[] = [];
  let from = 0;

  while (true) {
    let q = supabase
      .from('services')
      .select('name, type, city, orgnr')
      .eq('is_active', true)
      .range(from, from + PAGE_SIZE - 1);

    if (typeIds !== null) q = q.in('id', typeIds);

    const { data, error } = await q.returns<ServiceRow[]>();
    if (error) {
      console.error('❌ Supabase-feil:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    services.push(...data);
    process.stdout.write(`\r   Hentet: ${services.length.toLocaleString('nb-NO')} tjenester...`);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  process.stdout.write('\n');
  console.log(`   Totalt: ${services.length.toLocaleString('nb-NO')} tjenester`);

  // 2. Grupper etter kjedenavn
  const chainMap = new Map<string, {
    displayName: string;
    count: number;
    cities: Set<string>;
    rawNames: Set<string>;
  }>();

  for (const svc of services) {
    if (!svc.name) continue;
    const key = chainKey(svc.name);
    if (!key || key.length < 3) continue;

    if (!chainMap.has(key)) {
      chainMap.set(key, {
        displayName: extractBrandName(svc.name),
        count: 0,
        cities: new Set(),
        rawNames: new Set(),
      });
    }
    const entry = chainMap.get(key)!;
    entry.count++;
    if (svc.city) entry.cities.add(svc.city);
    entry.rawNames.add(svc.name);
  }

  // Kjeder fra DB = navn som dukker opp minCount+ ganger
  const dbChains = [...chainMap.entries()]
    .filter(([, v]) => v.count >= minCount)
    .sort(([, a], [, b]) => b.count - a.count);

  // Merge with known chains (known chains take priority, added at front if not already detected)
  const dbChainNames = new Set(dbChains.map(([, v]) => v.displayName.toLowerCase()));
  const knownOnly = KNOWN_CHAINS
    .filter(n => !dbChainNames.has(n.toLowerCase()))
    .map(n => ([`_known_${n.toLowerCase().replace(/\s+/g, '_')}`, {
      displayName: n,
      count: 0,
      cities: new Set<string>(),
      rawNames: new Set<string>(),
    }] as [string, { displayName: string; count: number; cities: Set<string>; rawNames: Set<string> }]));

  const allChains = [...knownOnly, ...dbChains];
  const todo = limitArg ? allChains.slice(0, limitArg) : allChains;

  console.log(`   ${dbChains.length} kjeder fra DB  +  ${knownOnly.length} kjente kjeder lagt til`);
  console.log(`   Totalt: ${allChains.length} kjeder å søke`);
  if (limitArg) console.log(`   Begrenset til ${limitArg} kjeder`);
  console.log(`   Delay mellom søk: ${delayMs} ms`);
  console.log();

  // Vis topp 10 fra DB
  console.log('   Topp kjeder fra DB:');
  dbChains.slice(0, 10).forEach(([, v], i) => {
    console.log(`   ${String(i + 1).padStart(2)}. ${v.displayName.padEnd(35)} ${v.count} i DB  (${[...v.cities].slice(0, 3).join(', ')})`);
  });
  console.log();

  // 3. Søk hver kjede via Serper Places API
  writeFileSync(outFile, '');
  let withPlaces = 0;
  let withoutPlaces = 0;
  let failed = 0;

  for (let i = 0; i < todo.length; i++) {
    const [key, info] = todo[i];
    const placesQuery = `${info.displayName} treningssenter`;

    process.stdout.write(
      `\r   [${String(i + 1).padStart(3)}/${todo.length}] ${info.displayName.slice(0, 28).padEnd(28)} `
    );

    let places: SerperPlacesResult[] = [];
    try {
      places = await searchPlaces(placesQuery);
    } catch (err) {
      failed++;
      process.stdout.write(`✗ feil`);
      const record = {
        chain: info.displayName,
        chain_key: key,
        db_count: info.count,
        db_cities: [...info.cities].slice(0, 10),
        search_query: placesQuery,
        error: err instanceof Error ? err.message : String(err),
        places: [],
      };
      appendFileSync(outFile, JSON.stringify(record) + '\n', 'utf-8');
      await new Promise(r => setTimeout(r, delayMs * 2));
      continue;
    }

    const mappedPlaces = places.map(p => ({
      name: p.title,
      address: p.address,
      lat: p.latitude ?? null,
      lon: p.longitude ?? null,
      phone: p.phone ?? null,
      website: p.website ?? null,
      rating: p.rating ?? null,
      category: p.category ?? null,
    }));

    const record = {
      chain: info.displayName,
      chain_key: key,
      db_count: info.count,
      db_cities: [...info.cities].slice(0, 10),
      db_sample_names: [...info.rawNames].slice(0, 5),
      search_query: placesQuery,
      places: mappedPlaces,
    };

    appendFileSync(outFile, JSON.stringify(record) + '\n', 'utf-8');

    if (mappedPlaces.length > 0) {
      withPlaces++;
      process.stdout.write(`✓ ${mappedPlaces.length} steder`);
    } else {
      withoutPlaces++;
      process.stdout.write('– ingen treff');
    }

    if (i < todo.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  process.stdout.write('\n\n');
  console.log('✅ Ferdig!');
  console.log(`   Med stedstreff  : ${withPlaces}`);
  console.log(`   Uten stedstreff : ${withoutPlaces}`);
  if (failed > 0) console.log(`   Feilet          : ${failed}`);
  console.log(`   Resultat        : ${outFile}`);
  console.log();
  console.log('Vis resultater:');
  console.log('  node -e "require(\'fs\').readFileSync(\'data/gym-chains.jsonl\',\'utf-8\').split(\'\\n\').filter(Boolean).slice(0,5).forEach(l => { const r = JSON.parse(l); console.log(r.chain, \'-\', r.places.length, \'steder\'); })"');
}

main().catch(err => {
  console.error('\n❌ Uventet feil:', err);
  process.exit(1);
});
