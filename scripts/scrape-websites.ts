#!/usr/bin/env tsx
/**
 * Web scraper: besøker nettsider fra websites.tsv og lagrer tekst per orgnr
 *
 * Leser : data/websites.tsv  (orgnr\turl, én per linje)
 * Skriver: data/scraped/{orgnr}.txt
 *
 * Usage:
 *   npx tsx scripts/scrape-websites.ts
 *   npx tsx scripts/scrape-websites.ts --limit=50
 *   npx tsx scripts/scrape-websites.ts --concurrency=10 --delay=300
 *   npx tsx scripts/scrape-websites.ts --resume        (hopper over eksisterende filer)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const concurrency = parseInt(args.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? '5');
const delayMs     = parseInt(args.find((a) => a.startsWith('--delay='))?.split('=')[1] ?? '400');
const limitArg    = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const resume      = args.includes('--resume');
const TIMEOUT_MS  = 12_000;

// ── Paths ───────────────────────────────────────────────────────────────────
const inPath = join(process.cwd(), 'data', 'websites.tsv');
const outDir = join(process.cwd(), 'data', 'scraped');
mkdirSync(outDir, { recursive: true });

// ── Load input ──────────────────────────────────────────────────────────────
function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // Prepend https:// if no protocol present
  const withProto = s.startsWith('http://') || s.startsWith('https://') ? s : `https://${s}`;
  try { new URL(withProto); return withProto; } catch { return null; }
}

const entries = readFileSync(inPath, 'utf-8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [orgnr, raw] = line.split('\t');
    const url = normalizeUrl(raw ?? '');
    return { orgnr: orgnr?.trim(), url };
  })
  .filter((r): r is { orgnr: string; url: string } =>
    Boolean(r.orgnr && r.url)
  );

const todo = limitArg ? entries.slice(0, limitArg) : entries;

console.log('🌐 SettDegEtMål – nettside-scraper');
console.log(`   Nettsider : ${todo.length.toLocaleString('nb-NO')}`);
console.log(`   Concurrent: ${concurrency}  |  Delay: ${delayMs} ms  |  Timeout: ${TIMEOUT_MS} ms`);
if (resume) console.log('   Resume    : ja (hopper over eksisterende filer)');
console.log();

// ── HTML → tekst ─────────────────────────────────────────────────────────────
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]{2,8};/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SettDegEtMal-bot/1.0; +https://settdegetmal.no)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nb,no;q=0.9,en;q=0.5',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html') && !ct.includes('text')) {
      throw new Error(`Ikke HTML-innhold (${ct.split(';')[0]})`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Semaphore ─────────────────────────────────────────────────────────────────
class Semaphore {
  private queue: (() => void)[] = [];
  constructor(private slots: number) {}
  acquire(): Promise<void> {
    if (this.slots > 0) { this.slots--; return Promise.resolve(); }
    return new Promise((resolve) => this.queue.push(resolve));
  }
  release(): void {
    if (this.queue.length > 0) this.queue.shift()!();
    else this.slots++;
  }
}

// ── Scrape loop ───────────────────────────────────────────────────────────────
const sem = new Semaphore(concurrency);
let done = 0, ok = 0, skipped = 0, failed = 0;

async function scrapeOne(orgnr: string, url: string): Promise<void> {
  await sem.acquire();
  const outFile = join(outDir, `${orgnr}.txt`);

  try {
    if (resume && existsSync(outFile)) {
      skipped++;
      return;
    }

    const html = await fetchText(url);
    const text = extractText(html);

    if (text.length < 30) {
      writeFileSync(outFile, `[TOM SIDE]\nURL: ${url}\n`, 'utf-8');
    } else {
      writeFileSync(outFile, `URL: ${url}\n\n${text}\n`, 'utf-8');
      ok++;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    writeFileSync(outFile, `[FEIL]\nURL: ${url}\nFeil: ${msg}\n`, 'utf-8');
    failed++;
  } finally {
    done++;
    process.stdout.write(
      `\r   ${done}/${todo.length}  ✓ ${ok}  ✗ ${failed}  skip ${skipped}   `
    );
    await new Promise((r) => setTimeout(r, delayMs));
    sem.release();
  }
}

async function main() {
  await Promise.all(todo.map(({ orgnr, url }) => scrapeOne(orgnr, url)));

  process.stdout.write('\n\n');
  console.log('✅ Ferdig!');
  console.log(`   Lagret : ${ok.toLocaleString('nb-NO')}`);
  console.log(`   Feilet : ${failed.toLocaleString('nb-NO')}`);
  if (skipped > 0) console.log(`   Hoppet : ${skipped.toLocaleString('nb-NO')}`);
  console.log(`   Mappe  : ${outDir}`);
}

main().catch((err) => {
  console.error('❌ Uventet feil:', err);
  process.exit(1);
});
