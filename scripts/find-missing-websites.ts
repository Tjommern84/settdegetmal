#!/usr/bin/env tsx
/**
 * Finn hjemmesider for tjenester som mangler website i databasen.
 *
 * Henter services WHERE website IS NULL fra Supabase,
 * søker via DuckDuckGo HTML (gratis, ingen API-nøkkel),
 * og oppdaterer website-feltet der en god URL finnes.
 *
 * Krev: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY i .env.local
 *
 * Usage:
 *   npx tsx scripts/find-missing-websites.ts
 *   npx tsx scripts/find-missing-websites.ts --dry-run
 *   npx tsx scripts/find-missing-websites.ts --limit=50
 *   npx tsx scripts/find-missing-websites.ts --type=pt
 *   npx tsx scripts/find-missing-websites.ts --category=oppfolging
 *   npx tsx scripts/find-missing-websites.ts --delay=2000
 */

import { readFileSync, appendFileSync, mkdirSync } from 'fs';
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
const args         = process.argv.slice(2);
const dryRun       = args.includes('--dry-run');
const limitArg     = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]    ?? '0') || null;
const typeFilter   = args.find(a => a.startsWith('--type='))?.split('=')[1]              ?? null;
const catFilter    = args.find(a => a.startsWith('--category='))?.split('=')[1]          ?? null;
const delayMs      = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1]    ?? '4000');

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ?? '';

// Log fil for resultater
const logDir  = join(process.cwd(), 'data');
const logFile = join(logDir, 'website-results.jsonl');
mkdirSync(logDir, { recursive: true });

// ── Domener som ikke er "ekte" hjemmesider ────────────────────────────────
const BLOCKLIST = [
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'tiktok.com',
  'youtube.com', 'google.com', 'google.no',
  'duckduckgo.com', 'bing.com',
  'gulesider.no', '1881.no', 'proff.no', 'purehelp.no', 'brreg.no',
  'yelp.com', 'tripadvisor.com', 'trustpilot.com',
  'finn.no', 'minside.no', 'dnt.no',
  'wikipedia.org', 'snl.no', 'wikidata.org',
  'maps.google.com', 'apple.com',
  'houzz.com', 'yellowpages.com', 'hotfrog.no',
  'microsoft.com', 'bing.com', 'msn.com',
  'blogg.no', 'nettavisen.no', 'vg.no', 'dagbladet.no', 'aftenposten.no',
  'nrk.no', 'tv2.no',
  'instruktorkatalogen.no', 'treningsoversikt.no', 'mintrener.no',
  'kart.finn.no', 'gule.no', 'bedriftssok.no',
  'utdanning.no', 'karriere.no', 'jobbnorge.no', 'nav.no',
  'kunnskapsbasen.no', 'helsenorge.no',
];

function isBlocklisted(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return BLOCKLIST.some(b => host === b || host.endsWith('.' + b));
  } catch {
    return true; // invalid URL → skip
  }
}

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]/g, '');
}

function domainMatchesName(url: string, name: string): boolean {
  try {
    const host = normalize(new URL(url).hostname.replace(/^www\./, '').split('.')[0]);
    const nameParts = name.toLowerCase().replace(/[^a-zæøå0-9]/g, ' ').split(' ')
      .filter(w => w.length >= 4).map(normalize);
    if (nameParts.length === 0) return false;
    return nameParts.some(part => host.includes(part) || part.includes(host));
  } catch { return false; }
}


// Words to strip from business names before searching — leaves the actual name/brand
const TITLE_WORDS = [
  // Job titles
  'personlig trener', 'kostholdsveileder', 'ernæringsfysiolog',
  'personlig', 'trener', 'coach', 'veileder', 'instruktør', 'instruktor',
  // Generic business words
  'online', 'tjenester', 'tjeneste', 'holding', 'forvaltning', 'invest', 'eiendom',
  // Connectors / legal suffixes
  ' og ', ' & ', ' - ', ' pt ',
  ' as$', ' da$', ' sa$',
];

function cleanSearchName(name: string): string {
  let s = name.toLowerCase();
  for (const w of TITLE_WORDS) {
    s = s.replace(new RegExp(w, 'gi'), ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

async function searchDDG(query: string): Promise<string[]> {
  const body = new URLSearchParams({ q: query, kl: 'no-no' });
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html',
    },
    body: body.toString(),
  });
  const html = await res.text();
  // DDG HTML POST returns direct https:// links in result hrefs
  return [...new Set(
    (html.match(/href="(https?:\/\/(?!duckduckgo)[^"]+)"/g) ?? []).map((m: string) => m.slice(6, -1))
  )];
}

async function findWebsite(name: string, city: string): Promise<string | null> {
  const cleanName = cleanSearchName(name);
  const urls = (await searchDDG(`${name} ${city}`)).filter(u => !isBlocklisted(u));
  for (const url of urls) {
    if (domainMatchesName(url, cleanName)) return url;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍  SettDegEtMål – finn manglende hjemmesider');
  if (dryRun) console.log('   [DRY RUN – ingen endringer lagres i DB]');
  console.log();

  if (!SUPABASE_URL) { console.error('❌ NEXT_PUBLIC_SUPABASE_URL mangler'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Hent tjenester uten hjemmeside ──────────────────────────────────────
  // Only process services shown on the site (main_category set = categorized)
  let query = supabase
    .from('services')
    .select('id, name, city, type, main_category')
    .or('website.is.null,website.eq.')
    .eq('is_active', true)
    .not('main_category', 'is', null)
    .order('rating_avg', { ascending: false, nullsFirst: false });

  if (typeFilter)  query = query.eq('type', typeFilter);
  if (catFilter)   query = query.eq('main_category', catFilter);
  if (limitArg)    query = query.limit(limitArg);
  else             query = query.limit(500);

  const { data: services, error } = await query;

  if (error) {
    console.error('❌ Supabase feil:', error.message);
    process.exit(1);
  }

  if (!services || services.length === 0) {
    console.log('✅ Ingen tjenester mangler hjemmeside (med disse filtrene).');
    return;
  }

  console.log(`📋 ${services.length} tjenester uten hjemmeside`);
  if (typeFilter)  console.log(`   Type-filter    : ${typeFilter}`);
  if (catFilter)   console.log(`   Kategori-filter: ${catFilter}`);
  console.log(`   Delay mellom søk: ${delayMs} ms`);
  console.log(`   Søkemotor       : DuckDuckGo HTML`);
  console.log();

  let found   = 0;
  let missing = 0;
  let errors  = 0;
  let updated = 0;

  for (let i = 0; i < services.length; i++) {
    const svc = services[i];
    const city = svc.city ?? '';
    const label = `${svc.name} (${city})`;

    process.stdout.write(
      `\r   [${String(i + 1).padStart(4)}/${services.length}] ${label.slice(0, 45).padEnd(45)} `
    );

    let website: string | null = null;
    try {
      website = await findWebsite(svc.name, city);
    } catch (err) {
      errors++;
      process.stdout.write('✗ søkefeil');
      appendFileSync(logFile, JSON.stringify({ id: svc.id, name: svc.name, city, website: null, error: String(err) }) + '\n');
      await new Promise(r => setTimeout(r, delayMs * 2));
      continue;
    }

    if (website) {
      found++;
      process.stdout.write(`✓ ${website.slice(0, 35)}`);

      appendFileSync(logFile, JSON.stringify({ id: svc.id, name: svc.name, city, website }) + '\n');

      if (!dryRun) {
        const { error: updateErr } = await supabase
          .from('services')
          .update({ website })
          .eq('id', svc.id);

        if (updateErr) {
          console.error(`\n     ✗ update ${svc.id}: ${updateErr.message}`);
          errors++;
        } else {
          updated++;
        }
      }
    } else {
      missing++;
      process.stdout.write('– ingen treff');
      appendFileSync(logFile, JSON.stringify({ id: svc.id, name: svc.name, city, website: null }) + '\n');
    }

    if (i < services.length - 1) await new Promise(r => setTimeout(r, delayMs));
  }

  process.stdout.write('\n\n');
  console.log('✅ Ferdig!');
  console.log(`   Fant hjemmeside : ${found}`);
  console.log(`   Ingen treff     : ${missing}`);
  if (!dryRun) console.log(`   Oppdatert i DB  : ${updated}`);
  if (errors > 0) console.log(`   Feil            : ${errors}`);
  console.log(`   Logg            : ${logFile}`);
  if (dryRun) console.log('\n   (Ingen endringer lagret – kjør uten --dry-run for å lagre)');
}

main().catch(err => {
  console.error('\n❌ Uventet feil:', err);
  process.exit(1);
});
