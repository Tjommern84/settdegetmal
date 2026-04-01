#!/usr/bin/env tsx
/**
 * Ekstraher strukturert informasjon fra scrapede nettsider.
 *
 * Leser : data/scraped/{orgnr}.txt
 * Skriver: data/extracted.jsonl  (én JSON-linje per bedrift)
 *
 * Usage:
 *   npx tsx scripts/extract-from-scraped.ts
 *   npx tsx scripts/extract-from-scraped.ts --limit=10
 *   npx tsx scripts/extract-from-scraped.ts --pretty   (lesbar JSON, én fil per bedrift)
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const limitArg = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const pretty = args.includes('--pretty');

const scrapedDir = join(process.cwd(), 'data', 'scraped');
const outPath    = join(process.cwd(), 'data', 'extracted.jsonl');
if (pretty) mkdirSync(join(process.cwd(), 'data', 'extracted'), { recursive: true });

// ── Type-hint nøkkelord ────────────────────────────────────────────────────
const TYPE_KEYWORDS: Record<string, string[]> = {
  styrke:       ['treningssenter', 'gym', 'fitness', 'vektrom', 'styrkerom', 'crossfit', 'hyrox', 'vekttrefning'],
  kondisjon:    ['løping', 'løpegruppe', 'spinning', 'sykling', 'kondisjon', 'utholdenhet', 'maraton', 'triatlon'],
  gruppe:       ['gruppetime', 'bootcamp', 'zumba', 'aerobic', 'sirkeltrening', 'tabata', 'step', 'dance fitness'],
  yoga:         ['yoga', 'pilates', 'barre', 'tai chi', 'qigong', 'stretching', 'avspenning', 'mindfulness', 'meditasjon'],
  spesialisert: ['fysioterapi', 'kiropraktor', 'ergoterapi', 'logoped', 'rehabilitering', 'osteopat', 'naprapat', 'idrettsmedisin', 'helsestudio'],
  livsstil:     ['kostholdsveiledning', 'livsstilscoach', 'vektnedgang', 'slankekurs', 'ernæringscoach'],
  outdoor:      ['turlag', 'fjellturer', 'klatring', 'friluftsliv', 'kajakk', 'sup', 'langrenn', 'orienteringsløp'],
  sport:        ['fotball', 'håndball', 'idrettslag', 'tennisklubb', 'svømmeklubb', 'skiklubb', 'basketklubb', 'volleyball', 'skyting', 'skytterklubb', 'kampsport', 'judo', 'karate'],
  pt:           ['personlig trener', 'personal trainer', 'pt-studio', 'one-to-one', 'en-til-en'],
  teknologi:    ['app', 'digital coaching', 'online trening', 'streaming', 'e-helse'],
};

// ── Regexer ────────────────────────────────────────────────────────────────

// +47 / 0047 prefix, alle formatvarianter
const RE_PHONE_PREFIX = /(?:\+47|0047)[\s.\-]?(\d{2})[\s.\-]?(\d{2})[\s.\-]?(\d{2})[\s.\-]?(\d{2})/g;
// (+47) format
const RE_PHONE_PAREN  = /\(\+47\)[\s]?(\d{2})[\s]?(\d{2})[\s]?(\d{2})[\s]?(\d{2})/g;
// Rent 8-sifret norsk nummer (begynner med 2-9, ikke et årstall 19xx/20xx)
const RE_PHONE_BARE   = /\b([2-9]\d{7})\b/g;

// Norsk postnummer + poststed – kun etter adresse-kontekst (komma, Postboks, eller etter gate/vei)
const RE_POSTAL_CTX  = /(?:,|Postboks\s+\d+,?)\s*(\d{4})\s+([A-ZÆØÅ][A-Za-zæøåÆØÅ\-]{2,24})\b/g;
// Fallback: frittstående postnummer, men strenger city-validering gjøres i kode
const RE_POSTAL_BARE = /\b(\d{4})\s+([A-ZÆØÅ][A-Za-zæøåÆØÅ\-]{2,24})\b/g;
// Gate/vei-adresse
const RE_STREET = /\b([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s]+(?:gate|gata|gaten|vei|veien|vegen|allé|plass|plassen|stien|torget|torvet)\s+\d+[a-zA-Z]?)/g;

// E-post
const RE_EMAIL = /\b([\w.+\-]+@[\w.\-]+\.(?:no|com|org|net|io|co))\b/gi;
const SPAM_DOMAINS = ['example', 'domain', 'email', 'wix', 'wordpress', 'yourdomain', 'test'];

// ── Hjelpefunksjoner ───────────────────────────────────────────────────────

function normalizePhone(digits: string): string {
  // Returner 8-sifret uten landskode
  return digits.replace(/\D/g, '').replace(/^47/, '').slice(-8);
}

function extractPhones(text: string): string[] {
  const found = new Set<string>();

  for (const m of text.matchAll(RE_PHONE_PREFIX)) {
    const digits = `${m[1]}${m[2]}${m[3]}${m[4]}`;
    found.add(digits);
  }
  for (const m of text.matchAll(RE_PHONE_PAREN)) {
    found.add(`${m[1]}${m[2]}${m[3]}${m[4]}`);
  }
  // Bare 8-sifret: kun ta med om det ikke er et årstall-mønster
  for (const m of text.matchAll(RE_PHONE_BARE)) {
    const n = m[1];
    if (/^(19|20)\d{6}$/.test(n)) continue;  // ligner årstall+løpenummer
    if (/^0{3,}/.test(n)) continue;            // mange nuller foran
    found.add(n);
  }

  return [...found].map(normalizePhone).filter((p) => p.length === 8);
}

function extractEmails(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(RE_EMAIL)) {
    const email = m[1].toLowerCase();
    const domain = email.split('@')[1]?.split('.')[0] ?? '';
    if (SPAM_DOMAINS.includes(domain)) continue;
    found.add(email);
  }
  return [...found];
}

// Kjente norske byer/steder (brukes som whitelist for "bare" postnummer-match)
const KNOWN_CITIES = new Set([
  'oslo','bergen','trondheim','stavanger','kristiansand','tromsø','drammen',
  'fredrikstad','sarpsborg','sandnes','bodø','ålesund','sandefjord','larvik',
  'tønsberg','moss','hamar','horten','gjøvik','lillehammer','molde','arendal',
  'porsgrunn','skien','halden','kongsberg','harstad','narvik','alta','lillestrøm',
  'jessheim','ski','ås','bærum','asker','lørenskog','skedsmokorset','rælingen',
  'oppegård','nesoddtangen','frogner','nittedal','vestby','eidsvoll','nes',
  'brumunddal','elverum','gjøvik','raufoss','hønefoss','hokksund','kongsvinger',
  'brønnøysund','mosjøen','mo','sandnessjøen','leknes','svolvær','finnsnes',
  'stord','haugesund','farsund','mandal','flekkefjord','egersund','bryne',
  'kleppe','varhaug','nærbø','klepp','askøy','fjell','sotra','øygarden',
  'straume','fornebu','lysaker','bekkestua','stabekk','sandvika','skøyen',
  'majorstuen','torshov','grünerløkka','tøyen','gamlebyen','kvadraturen',
]);

function isLikelyCity(city: string): boolean {
  const lower = city.toLowerCase();
  // Whitelist-sjekk
  if (KNOWN_CITIES.has(lower)) return true;
  // Minimum 3 tegn, ingen sifre
  if (city.length < 3 || /\d/.test(city)) return false;
  // Ikke vanlige norske pronomen/ord
  const NOT_CITY_WORDS = new Set([
    'vi','de','han','hun','det','den','og','er','ikke','for','med','på','av',
    'til','fra','som','men','har','var','vil','kan','skal','ble','bli','alt',
    'alle','men','ved','etter','under','over','uten','inn','ut','ny','nye',
    'den','det','en','et','et','hva','når','hvor','slik',
    // innholds-ord fra blogger
    'styret','leder','nyheter','kontakt','om','oss','mer','vis','se',
    'les','gå','klikk','kurs','program','side','sider','lag','test',
    'bachelor','master','stian','rejlers','kulturfeltets','kvinner','kulturen',
  ]);
  if (NOT_CITY_WORDS.has(lower)) return false;
  // Ser ut som et stedsnavn (bokstaver og bindestrek)
  return /^[A-Za-zæøåÆØÅ\-]+$/.test(city);
}

function extractPostal(text: string): { postal_code: string; city: string } | null {
  // Prøv først i adresse-kontekst (etter komma eller Postboks)
  RE_POSTAL_CTX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_POSTAL_CTX.exec(text)) !== null) {
    const code = m[1];
    const city = m[2].trim();
    if (isLikelyCity(city)) return { postal_code: code, city };
  }
  // Fallback: frittstående, men strengere validering
  RE_POSTAL_BARE.lastIndex = 0;
  while ((m = RE_POSTAL_BARE.exec(text)) !== null) {
    const code = m[1];
    const city = m[2].trim();
    // Avvis tall som ligner årstall (1990–2030)
    const n = parseInt(code, 10);
    if (n >= 1990 && n <= 2030) continue;
    if (KNOWN_CITIES.has(city.toLowerCase())) return { postal_code: code, city };
  }
  return null;
}

function extractStreet(text: string): string | null {
  RE_STREET.lastIndex = 0;
  const m = RE_STREET.exec(text);
  return m ? m[1].trim() : null;
}

function extractTypeHints(text: string): string[] {
  const lower = text.toLowerCase();
  const hints: string[] = [];
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      hints.push(type);
    }
  }
  return hints;
}

// ── Behandle én fil ────────────────────────────────────────────────────────

type Extracted = {
  orgnr: string;
  url: string;
  status: 'ok' | 'error' | 'empty';
  phones: string[];
  emails: string[];
  postal_code: string | null;
  city: string | null;
  address_line: string | null;
  type_hints: string[];
  raw_length: number;
};

function processFile(orgnr: string, filePath: string): Extracted {
  const raw = readFileSync(filePath, 'utf-8');
  const urlMatch = raw.match(/^URL:\s*(.+)$/m);
  const url = urlMatch?.[1]?.trim() ?? '';

  const base: Extracted = {
    orgnr,
    url,
    status: 'ok',
    phones: [],
    emails: [],
    postal_code: null,
    city: null,
    address_line: null,
    type_hints: [],
    raw_length: raw.length,
  };

  if (raw.startsWith('[FEIL]'))  return { ...base, status: 'error' };
  if (raw.startsWith('[TOM SIDE]')) return { ...base, status: 'empty' };

  // Innhold uten URL-linje
  const content = raw.replace(/^URL:.*\n\n?/, '');

  const postal = extractPostal(content);
  const street = extractStreet(content);

  const address_line =
    street && postal
      ? `${street}, ${postal.postal_code} ${postal.city}`
      : postal
      ? `${postal.postal_code} ${postal.city}`
      : street ?? null;

  return {
    ...base,
    phones: extractPhones(content),
    emails: extractEmails(content),
    postal_code: postal?.postal_code ?? null,
    city: postal?.city ?? null,
    address_line,
    type_hints: extractTypeHints(content),
  };
}

// ── Hovedloop ─────────────────────────────────────────────────────────────

const files = readdirSync(scrapedDir)
  .filter((f) => f.endsWith('.txt'))
  .sort();

const todo = limitArg ? files.slice(0, limitArg) : files;
console.log(`🔍 Ekstraherer fra ${todo.length} filer...`);

const results: Extracted[] = [];
let withPhone = 0, withEmail = 0, withAddress = 0;

for (const file of todo) {
  const orgnr = file.replace('.txt', '');
  const result = processFile(orgnr, join(scrapedDir, file));
  results.push(result);
  if (result.phones.length)   withPhone++;
  if (result.emails.length)   withEmail++;
  if (result.address_line)    withAddress++;
}

// Skriv JSONL
const jsonl = results.map((r) => JSON.stringify(r)).join('\n') + '\n';
writeFileSync(outPath, jsonl, 'utf-8');

// Valgfritt: én JSON-fil per bedrift
if (pretty) {
  for (const r of results) {
    writeFileSync(
      join(process.cwd(), 'data', 'extracted', `${r.orgnr}.json`),
      JSON.stringify(r, null, 2),
      'utf-8'
    );
  }
}

// ── Rapport ────────────────────────────────────────────────────────────────
const ok    = results.filter((r) => r.status === 'ok').length;
const error = results.filter((r) => r.status === 'error').length;
const empty = results.filter((r) => r.status === 'empty').length;

console.log();
console.log('✅ Ferdig!');
console.log(`   Behandlet  : ${results.length}`);
console.log(`   OK / feil / tomme: ${ok} / ${error} / ${empty}`);
console.log(`   Med telefon: ${withPhone}`);
console.log(`   Med e-post : ${withEmail}`);
console.log(`   Med adresse: ${withAddress}`);
console.log();

// Type-hint statistikk
const typeCount: Record<string, number> = {};
for (const r of results) {
  for (const h of r.type_hints) {
    typeCount[h] = (typeCount[h] ?? 0) + 1;
  }
}
if (Object.keys(typeCount).length > 0) {
  console.log('   Type-hint fordeling:');
  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${type.padEnd(14)}: ${count}`);
  }
}

console.log();
console.log(`   Utdata: ${outPath}`);
