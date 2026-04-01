#!/usr/bin/env tsx
/**
 * Finn norske idrettslag og klubber via Serper.dev (Google Places API)
 *
 * Søker etter kombinasjoner av idrettstype × norsk by.
 * Lagrer resultater i data/sport-clubs.jsonl
 *
 * Krev: SERPER_API_KEY i .env.local
 *
 * Usage:
 *   npx tsx scripts/find-sport-clubs.ts
 *   npx tsx scripts/find-sport-clubs.ts --limit=3
 *   npx tsx scripts/find-sport-clubs.ts --sport=fotball
 *   npx tsx scripts/find-sport-clubs.ts --city=oslo
 *   npx tsx scripts/find-sport-clubs.ts --delay=2000
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
  } catch { /* .env.local not found */ }
}
loadEnv();

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitArg    = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]  ?? '0') || null;
const sportFilter = args.find(a => a.startsWith('--sport='))?.split('=')[1]                   ?? null;
const cityFilter  = args.find(a => a.startsWith('--city='))?.split('=')[1]?.toLowerCase()     ?? null;
const delayMs     = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1]  ?? '1500');

// ── Config ────────────────────────────────────────────────────────────────
const SERPER_API_KEY = process.env.SERPER_API_KEY;
const outDir  = join(process.cwd(), 'data');
const outFile = join(outDir, 'sport-clubs.jsonl');
mkdirSync(outDir, { recursive: true });

// ── Sport searches ────────────────────────────────────────────────────────
const SPORT_SEARCHES: Array<{ sport: string; query: string; tags: string[] }> = [
  { sport: 'fotball',     query: 'fotballklubb',      tags: ['fotball'] },
  { sport: 'handball',    query: 'håndballklubb',     tags: ['handball'] },
  { sport: 'basketball',  query: 'basketballklubb',   tags: ['basket'] },
  { sport: 'volleyball',  query: 'volleyballklubb',   tags: ['volleyball'] },
  { sport: 'svomming',    query: 'svømmeklubb',       tags: ['svomming'] },
  { sport: 'tennis',      query: 'tennisklubb',       tags: ['tennis'] },
  { sport: 'badminton',   query: 'badmintonklubb',    tags: ['badminton'] },
  { sport: 'golf',        query: 'golfklubb',         tags: ['golf'] },
  { sport: 'ski',         query: 'skiklubb',          tags: ['ski'] },
  { sport: 'ishockey',    query: 'ishockeyklubb',     tags: ['ishockey'] },
  { sport: 'friidrett',   query: 'friidrettsklubb',   tags: ['friidrett'] },
  { sport: 'kampsport',   query: 'kampsport dojo',    tags: ['kampsport'] },
  { sport: 'turn',        query: 'turnklubb',         tags: ['turn'] },
  { sport: 'padel',       query: 'padelklubb',        tags: ['padel'] },
  { sport: 'orientering', query: 'orienteringsklubb', tags: ['orientering'] },
  { sport: 'sykkel',      query: 'sykkelklubb',       tags: ['sykkel'] },
  { sport: 'rugby',       query: 'rugbyklubb',        tags: ['rugby'] },
  { sport: 'roing',       query: 'roklubb',           tags: ['roing'] },
  { sport: 'klatring',    query: 'klatresesenter',    tags: ['klatring'] },
  { sport: 'langrenn',    query: 'langrennsklubb',    tags: ['langrenn', 'ski'] },
  { sport: 'generelt',    query: 'idrettslag',        tags: ['idrettslag'] },
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
  console.log('⚽  SettDegEtMål – finn idrettslag og klubber via Google Places');
  console.log();

  if (!SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY mangler i .env.local');
    process.exit(1);
  }

  // Build search matrix
  const sports = sportFilter
    ? SPORT_SEARCHES.filter(s => s.sport === sportFilter)
    : SPORT_SEARCHES;

  const cities = cityFilter
    ? CITIES.filter(c => c.toLowerCase() === cityFilter)
    : CITIES;

  if (sports.length === 0) {
    console.error(`❌ Ukjent sport: ${sportFilter}`);
    console.error('   Gyldige: ' + SPORT_SEARCHES.map(s => s.sport).join(', '));
    process.exit(1);
  }

  // Build flat list of searches
  const searches: Array<{ sport: string; query: string; tags: string[]; city: string }> = [];
  for (const s of sports) {
    for (const city of cities) {
      searches.push({ ...s, city });
    }
  }

  const todo = limitArg ? searches.slice(0, limitArg) : searches;

  console.log(`   ${sports.length} idretter × ${cities.length} byer = ${searches.length} søk`);
  if (limitArg) console.log(`   Begrenset til ${limitArg} søk`);
  console.log(`   Delay mellom søk: ${delayMs} ms`);
  console.log(`   Output: ${outFile}`);
  console.log();

  writeFileSync(outFile, '', 'utf-8');

  let withPlaces = 0;
  let withoutPlaces = 0;
  let failed = 0;

  for (let i = 0; i < todo.length; i++) {
    const { sport, query, tags, city } = todo[i];
    const fullQuery = `${query} ${city}`;

    process.stdout.write(
      `\r   [${String(i + 1).padStart(4)}/${todo.length}] ${fullQuery.slice(0, 35).padEnd(35)} `
    );

    let places: SerperPlace[] = [];
    try {
      places = await searchPlaces(fullQuery);
    } catch (err) {
      failed++;
      process.stdout.write('✗ feil');
      const record = {
        sport,
        query: fullQuery,
        city_searched: city.toLowerCase(),
        tags,
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
      sport,
      query: fullQuery,
      city_searched: city.toLowerCase(),
      tags,
      places: mappedPlaces,
    };

    appendFileSync(outFile, JSON.stringify(record) + '\n', 'utf-8');

    if (mappedPlaces.length > 0) {
      withPlaces++;
      process.stdout.write(`✓ ${mappedPlaces.length} treff`);
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
  console.log(`   Med treff    : ${withPlaces}`);
  console.log(`   Uten treff   : ${withoutPlaces}`);
  if (failed > 0) console.log(`   Feilet       : ${failed}`);
  console.log(`   Resultat     : ${outFile}`);
  console.log();
  console.log('Neste steg:');
  console.log('  npm run clubs:push:dry   – forhåndsvis hva som pushes');
  console.log('  npm run clubs:push       – push til Supabase');
}

main().catch(err => {
  console.error('\n❌ Uventet feil:', err);
  process.exit(1);
});
