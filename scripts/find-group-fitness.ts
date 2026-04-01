#!/usr/bin/env tsx
/**
 * Finn gruppetimer, yoga, utendørs trening, bootcamp og løpegrupper
 * via Serper.dev (Google Places API).
 *
 * Søker kombinasjoner av kategori × norsk by.
 * Lagrer resultater i data/group-fitness.jsonl
 *
 * Krev: SERPER_API_KEY i .env.local
 *
 * Usage:
 *   npx tsx scripts/find-group-fitness.ts
 *   npx tsx scripts/find-group-fitness.ts --limit=10
 *   npx tsx scripts/find-group-fitness.ts --category=yoga
 *   npx tsx scripts/find-group-fitness.ts --city=oslo
 *   npx tsx scripts/find-group-fitness.ts --delay=2000
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

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
const limitArg      = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]    ?? '0') || null;
const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1]?.toLowerCase() ?? null;
const cityFilter     = args.find(a => a.startsWith('--city='))?.split('=')[1]?.toLowerCase()     ?? null;
const delayMs        = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1]   ?? '1500');

// ── Config ────────────────────────────────────────────────────────────────
const SERPER_API_KEY = process.env.SERPER_API_KEY;
const outDir  = join(process.cwd(), 'data');
const outFile = join(outDir, 'group-fitness.jsonl');
mkdirSync(outDir, { recursive: true });

// ── Search definitions ────────────────────────────────────────────────────
interface SearchDef {
  category: string;
  term: string;
  query: string;
  type: string;
  mainCategory: string;
  tags: string[];
  goals: string[];
  venues: string[];
  priceLevel: string;
}

const SEARCHES: SearchDef[] = [
  // Gruppetime / gruppefitness
  { category: 'gruppetime', term: 'gruppetime',    query: 'gruppetime treningssenter', type: 'gruppe', mainCategory: 'trene-sammen', tags: ['gruppe'],             goals: ['kondisjon','weight_loss','start'], venues: ['gym'],              priceLevel: 'medium' },
  { category: 'gruppetime', term: 'gruppefitness', query: 'gruppefitness studio',     type: 'gruppe', mainCategory: 'trene-sammen', tags: ['gruppe'],             goals: ['kondisjon','weight_loss'],        venues: ['gym'],              priceLevel: 'medium' },
  { category: 'gruppetime', term: 'spinning',      query: 'spinningklasse senter',    type: 'gruppe', mainCategory: 'trene-sammen', tags: ['gruppe','spinning'],  goals: ['kondisjon'],                     venues: ['gym'],              priceLevel: 'medium' },
  { category: 'gruppetime', term: 'aerobic',       query: 'aerobic zumba klasser',    type: 'gruppe', mainCategory: 'trene-sammen', tags: ['gruppe','aerobic'],   goals: ['kondisjon','weight_loss'],        venues: ['gym'],              priceLevel: 'medium' },

  // Yoga
  { category: 'yoga', term: 'yogastudio',  query: 'yogastudio',    type: 'yoga', mainCategory: 'trene-sammen', tags: ['yoga'],                goals: ['mobility','stress','start'], venues: ['gym'],              priceLevel: 'medium' },
  { category: 'yoga', term: 'hot-yoga',    query: 'hot yoga',      type: 'yoga', mainCategory: 'trene-sammen', tags: ['yoga','hot-yoga'],     goals: ['mobility','stress'],         venues: ['gym'],              priceLevel: 'medium' },
  { category: 'yoga', term: 'yin-yoga',    query: 'yin yoga klasse', type: 'yoga', mainCategory: 'trene-sammen', tags: ['yoga','yin'],       goals: ['mobility','stress'],         venues: ['gym'],              priceLevel: 'medium' },
  { category: 'yoga', term: 'pilates',     query: 'pilatessenter', type: 'yoga', mainCategory: 'trene-sammen', tags: ['yoga','pilates'],      goals: ['mobility','rehab'],          venues: ['gym'],              priceLevel: 'medium' },
  { category: 'yoga', term: 'meditasjon',  query: 'meditasjonskurs senter', type: 'mindbody', mainCategory: 'trene-sammen', tags: ['yoga','meditasjon'], goals: ['stress','mobility'], venues: ['gym','home'], priceLevel: 'medium' },

  // Utendørs / outdoor
  { category: 'outdoor', term: 'utendørs-trening', query: 'utendørs trening gruppe',  type: 'outdoor', mainCategory: 'trene-sammen', tags: ['outdoor'],                  goals: ['kondisjon','start'],           venues: ['outdoor'],          priceLevel: 'low'    },
  { category: 'outdoor', term: 'park-workout',     query: 'park workout Oslo',         type: 'outdoor', mainCategory: 'trene-sammen', tags: ['outdoor'],                  goals: ['kondisjon','start'],           venues: ['outdoor'],          priceLevel: 'free'   },
  { category: 'outdoor', term: 'friluftsliv',      query: 'friluftsliv kurs',          type: 'outdoor', mainCategory: 'trene-sammen', tags: ['outdoor','friluftsliv'],    goals: ['kondisjon','start'],           venues: ['outdoor'],          priceLevel: 'low'    },
  { category: 'outdoor', term: 'klatring-outdoor', query: 'klatring utendørs',         type: 'outdoor', mainCategory: 'trene-sammen', tags: ['outdoor','klatring'],       goals: ['strength','kondisjon'],        venues: ['outdoor'],          priceLevel: 'low'    },
  { category: 'outdoor', term: 'triathlon',        query: 'triathlonklubb',            type: 'outdoor', mainCategory: 'trene-sammen', tags: ['outdoor','friidrett'],      goals: ['kondisjon','endurance'],       venues: ['outdoor'],          priceLevel: 'low'    },

  // Bootcamp
  { category: 'bootcamp', term: 'bootcamp',        query: 'bootcamp trening',          type: 'gruppe', mainCategory: 'trene-sammen', tags: ['bootcamp','gruppe'],         goals: ['strength','kondisjon','weight_loss'], venues: ['outdoor','gym'], priceLevel: 'medium' },
  { category: 'bootcamp', term: 'militærtrening',  query: 'militærtrening gruppe',     type: 'gruppe', mainCategory: 'trene-sammen', tags: ['bootcamp'],                  goals: ['strength','kondisjon'],        venues: ['outdoor'],          priceLevel: 'medium' },
  { category: 'bootcamp', term: 'hiit',            query: 'HIIT klasse treningssenter', type: 'gruppe', mainCategory: 'trene-sammen', tags: ['bootcamp','gruppe','hiit'], goals: ['kondisjon','weight_loss'],     venues: ['gym'],              priceLevel: 'medium' },
  { category: 'bootcamp', term: 'crossfit-wod',    query: 'CrossFit klasse',           type: 'gruppe', mainCategory: 'trene-sammen', tags: ['bootcamp','crossfit'],       goals: ['strength','kondisjon'],        venues: ['gym'],              priceLevel: 'medium' },

  // Løpegruppe / kondisjon
  { category: 'løpegruppe', term: 'løpeklubb',    query: 'løpeklubb',              type: 'sport', mainCategory: 'trene-sammen', tags: ['løpegruppe','friidrett'],   goals: ['kondisjon','endurance'],  venues: ['outdoor'],           priceLevel: 'low'   },
  { category: 'løpegruppe', term: 'løpegruppe',   query: 'løpegruppe fellesøkt',   type: 'sport', mainCategory: 'trene-sammen', tags: ['løpegruppe'],               goals: ['kondisjon','endurance'],  venues: ['outdoor'],           priceLevel: 'free'  },
  { category: 'løpegruppe', term: 'maraton',      query: 'maratontreningsgruppe',  type: 'sport', mainCategory: 'trene-sammen', tags: ['løpegruppe','maraton'],     goals: ['kondisjon','endurance'],  venues: ['outdoor'],           priceLevel: 'low'   },
  { category: 'løpegruppe', term: 'kondisjon',    query: 'kondisjonstrening gruppe', type: 'gruppe', mainCategory: 'trene-sammen', tags: ['løpegruppe','kondisjon'], goals: ['kondisjon'],             venues: ['outdoor','gym'],     priceLevel: 'medium' },
];

// ── Norwegian cities ──────────────────────────────────────────────────────
const CITIES = [
  'Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Tromsø',
  'Drammen', 'Fredrikstad', 'Kristiansand', 'Sandnes', 'Haugesund',
  'Tønsberg', 'Skien', 'Porsgrunn', 'Ålesund', 'Sandefjord',
  'Moss', 'Sarpsborg', 'Bodø', 'Hamar', 'Gjøvik',
  'Larvik', 'Halden', 'Arendal', 'Molde', 'Harstad',
  'Alta', 'Lillestrøm', 'Asker', 'Jessheim', 'Kongsberg',
];

// ── Serper Places API ─────────────────────────────────────────────────────
interface SerperPlace {
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
  places?: SerperPlace[];
}

async function searchPlaces(query: string): Promise<SerperPlace[]> {
  const res = await fetch('https://google.serper.dev/places', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl: 'no', hl: 'no' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Serper HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json() as SerperPlacesResponse;
  return data.places ?? [];
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏃  SettDegEtMål – finn gruppetimer, yoga, outdoor, bootcamp, løpegrupper');
  console.log();

  if (!SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY mangler i .env.local');
    process.exit(1);
  }

  const searches = categoryFilter
    ? SEARCHES.filter(s => s.category === categoryFilter)
    : SEARCHES;

  if (searches.length === 0) {
    console.error(`❌ Ukjent kategori: ${categoryFilter}`);
    console.error('   Gyldige: ' + [...new Set(SEARCHES.map(s => s.category))].join(', '));
    process.exit(1);
  }

  const cities = cityFilter
    ? CITIES.filter(c => c.toLowerCase() === cityFilter)
    : CITIES;

  const todo: Array<SearchDef & { city: string }> = [];
  for (const s of searches) {
    for (const city of cities) {
      todo.push({ ...s, city });
    }
  }

  const batch = limitArg ? todo.slice(0, limitArg) : todo;

  console.log(`   ${searches.length} søketermer × ${cities.length} byer = ${todo.length} søk`);
  if (limitArg) console.log(`   Begrenset til ${limitArg} søk`);
  if (categoryFilter) console.log(`   Kategori: ${categoryFilter}`);
  console.log(`   Delay mellom søk: ${delayMs} ms`);
  console.log(`   Output: ${outFile}`);
  console.log();

  writeFileSync(outFile, '', 'utf-8');

  let withPlaces = 0;
  let withoutPlaces = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const { category, term, query, type, mainCategory, tags, goals, venues, priceLevel, city } = batch[i];
    const fullQuery = `${query} ${city}`;

    process.stdout.write(
      `\r   [${String(i + 1).padStart(4)}/${batch.length}] ${fullQuery.slice(0, 40).padEnd(40)} `
    );

    let places: SerperPlace[] = [];
    try {
      places = await searchPlaces(fullQuery);
    } catch (err) {
      failed++;
      process.stdout.write('✗ feil');
      appendFileSync(outFile, JSON.stringify({
        category, term, query: fullQuery, city_searched: city.toLowerCase(),
        type, mainCategory, tags, goals, venues, priceLevel,
        error: String(err), places: [],
      }) + '\n', 'utf-8');
      await new Promise(r => setTimeout(r, delayMs * 2));
      continue;
    }

    const mappedPlaces = places.map(p => ({
      name: p.title,
      address: p.address,
      lat: p.latitude  ?? null,
      lon: p.longitude ?? null,
      phone:   p.phone   ?? null,
      website: p.website ?? null,
      rating:  p.rating  ?? null,
      category: p.category ?? null,
    }));

    appendFileSync(outFile, JSON.stringify({
      category, term, query: fullQuery, city_searched: city.toLowerCase(),
      type, mainCategory, tags, goals, venues, priceLevel,
      places: mappedPlaces,
    }) + '\n', 'utf-8');

    if (mappedPlaces.length > 0) {
      withPlaces++;
      process.stdout.write(`✓ ${mappedPlaces.length} treff`);
    } else {
      withoutPlaces++;
      process.stdout.write('– ingen treff');
    }

    if (i < batch.length - 1) await new Promise(r => setTimeout(r, delayMs));
  }

  process.stdout.write('\n\n');
  console.log('✅ Ferdig!');
  console.log(`   Med treff    : ${withPlaces}`);
  console.log(`   Uten treff   : ${withoutPlaces}`);
  if (failed > 0) console.log(`   Feilet       : ${failed}`);
  console.log(`   Resultat     : ${outFile}`);
  console.log();
  console.log('Neste steg:');
  console.log('  npm run groups:push:dry   – forhåndsvis hva som pushes');
  console.log('  npm run groups:push       – push til Supabase');
}

main().catch(err => {
  console.error('\n❌ Uventet feil:', err);
  process.exit(1);
});
