/**
 * POST /api/refresh-city
 *
 * Background city data refresh triggered by user searches.
 * Runs Serper.dev searches for PT-er, ernæringsrådgivere and idrettslag
 * for the given city and pushes new results to Supabase.
 *
 * Enforces a 24-hour per-city cooldown to limit API usage.
 *
 * Body: { city: string }
 * Returns: { status: 'fresh' | 'refreshed' | 'error', added?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ?? '';
const SERPER_API_KEY = process.env.SERPER_API_KEY ?? '';

const COOLDOWN_HOURS = 24;
const DELAY_MS = 1200; // ms between Serper requests

// ── Search queries to run per city ────────────────────────────────────────────

interface SearchSpec {
  term: string;
  query: string;
  type: string;
  mainCategory: string;
  tags: string[];
  goals: string[];
  venues: string[];
  idPrefix: string;
}

const SEARCH_SPECS: SearchSpec[] = [
  // PT-er
  { term: 'personlig-trener',   query: 'personlig trener',  type: 'pt', mainCategory: 'oppfolging', tags: ['pt'],           goals: ['strength','weight_loss','start'], venues: ['home','gym'],    idPrefix: 'bg_pt' },
  { term: 'personal-trainer',   query: 'personal trainer',  type: 'pt', mainCategory: 'oppfolging', tags: ['pt'],           goals: ['strength','weight_loss','start'], venues: ['home','gym'],    idPrefix: 'bg_pt' },
  // Ernæring
  { term: 'ernæringsfysiolog',  query: 'ernæringsfysiolog', type: 'livsstil', mainCategory: 'oppfolging', tags: ['ernæring'], goals: ['weight_loss','start'],           venues: ['home','gym'],    idPrefix: 'bg_ern' },
  { term: 'kostholdsrådgiver',  query: 'kostholdsrådgiver', type: 'livsstil', mainCategory: 'oppfolging', tags: ['ernæring','kosthold'], goals: ['weight_loss'], venues: ['home','gym'],    idPrefix: 'bg_ern' },
  // Idrettslag
  { term: 'fotball',            query: 'fotballklubb',      type: 'sport', mainCategory: 'aktivitet-sport', tags: ['fotball','idrettslag'],    goals: ['kondisjon','start'], venues: ['outdoor','gym'], idPrefix: 'bg_sc' },
  { term: 'håndball',           query: 'håndballklubb',     type: 'sport', mainCategory: 'aktivitet-sport', tags: ['håndball','idrettslag'],   goals: ['kondisjon','start'], venues: ['gym'],           idPrefix: 'bg_sc' },
  { term: 'svømmeklubb',        query: 'svømmeklubb',       type: 'sport', mainCategory: 'aktivitet-sport', tags: ['svømming','idrettslag'],   goals: ['kondisjon'],        venues: ['gym'],           idPrefix: 'bg_sc' },
  { term: 'idrettslag',         query: 'idrettslag',        type: 'sport', mainCategory: 'aktivitet-sport', tags: ['idrettslag'],             goals: ['kondisjon','start'], venues: ['outdoor','gym'], idPrefix: 'bg_sc' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SerperPlace {
  title: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  rating?: number;
  category?: string;
}

async function serperSearch(query: string): Promise<SerperPlace[]> {
  const res = await fetch('https://google.serper.dev/places', {
    method: 'POST',
    headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'no', hl: 'no' }),
  });
  if (!res.ok) return [];
  const data = await res.json() as { places?: SerperPlace[] };
  return data.places ?? [];
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function makeId(prefix: string, term: string, address: string): string {
  return prefix + '_' + `${term}_${address}`
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 75);
}

function isNorwegianAddress(address?: string): boolean {
  if (!address || address.trim().length < 5) return false;
  if (!/\b\d{4}\b/.test(address)) return false;
  if (/india|new delhi|stockholm|sweden|denmark|finland|berlin|london|paris/i.test(address)) return false;
  return true;
}

function extractCity(address: string): string | null {
  const parts = address.split(',');
  const last = parts[parts.length - 1].trim();
  const match = last.match(/^\d{4}\s+(.+)$/);
  if (match) return match[1].trim().toLowerCase();
  if (last.length > 2 && last.length < 40) return last.toLowerCase();
  return null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERPER_API_KEY) {
    return NextResponse.json({ status: 'error', reason: 'not configured' }, { status: 500 });
  }

  let city: string;
  try {
    const body = await req.json() as { city?: unknown };
    if (typeof body.city !== 'string' || !body.city.trim()) {
      return NextResponse.json({ status: 'error', reason: 'city required' }, { status: 400 });
    }
    city = body.city.trim().toLowerCase();
  } catch {
    return NextResponse.json({ status: 'error', reason: 'invalid json' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Check cooldown ─────────────────────────────────────────────────────────
  const { data: logRow } = await supabase
    .from('city_refresh_log')
    .select('last_refreshed_at')
    .eq('city', city)
    .maybeSingle();

  if (logRow?.last_refreshed_at) {
    const ageHours = (Date.now() - new Date(logRow.last_refreshed_at).getTime()) / 3_600_000;
    if (ageHours < COOLDOWN_HOURS) {
      return NextResponse.json({ status: 'fresh', ageHours: Math.round(ageHours) });
    }
  }

  // ── Mark refresh started (upsert) ─────────────────────────────────────────
  await supabase.from('city_refresh_log').upsert(
    { city, last_refreshed_at: new Date().toISOString(), refresh_count: (logRow ? 1 : 0) + 1 },
    { onConflict: 'city' },
  );

  // ── Run searches ───────────────────────────────────────────────────────────
  let added = 0;

  for (let i = 0; i < SEARCH_SPECS.length; i++) {
    const spec = SEARCH_SPECS[i];
    const cityDisplay = city.charAt(0).toUpperCase() + city.slice(1);
    const fullQuery = `${spec.query} ${cityDisplay}`;

    const places = await serperSearch(fullQuery);

    for (const place of places) {
      if (!isNorwegianAddress(place.address)) continue;

      const id = makeId(spec.idPrefix, spec.term, place.address ?? place.title);
      const effectiveCity = extractCity(place.address ?? '') ?? city;

      const serviceRow = {
        id,
        name: place.title,
        type: spec.type,
        main_category: spec.mainCategory,
        description: `${spec.query.charAt(0).toUpperCase() + spec.query.slice(1)} i ${cityDisplay}`,
        address: place.address ?? null,
        city: effectiveCity,
        phone: place.phone ?? null,
        website: place.website ?? null,
        rating_avg: place.rating ?? 0,
        rating_count: 0,
        is_active: true,
        tags: spec.tags,
        goals: spec.goals,
        venues: spec.venues,
        coverage: [],
        price_level: spec.type === 'pt' ? 'high' : 'medium',
        owner_user_id: null,
      };

      const { error } = await supabase
        .from('services')
        .upsert(serviceRow, { onConflict: 'id', ignoreDuplicates: true });

      if (!error) {
        // Set base_location if coords available
        if (place.latitude && place.longitude) {
          await supabase
            .from('services')
            .update({ base_location: `SRID=4326;POINT(${place.longitude} ${place.latitude})` })
            .eq('id', id);
        }

        // Upsert coverage
        await supabase
          .from('service_coverage')
          .upsert({ service_id: id, type: 'city', city: effectiveCity }, { onConflict: 'service_id,type,city', ignoreDuplicates: true });

        added++;
      }
    }

    if (i < SEARCH_SPECS.length - 1) await sleep(DELAY_MS);
  }

  return NextResponse.json({ status: 'refreshed', city, added });
}
