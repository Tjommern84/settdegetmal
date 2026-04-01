#!/usr/bin/env tsx
/**
 * Builds Oslo postal-code -> borough mapping from Erik Bolstad's postnummer page.
 *
 * Output:
 *   data/reference/oslo-postnummer-bydeler.json
 *
 * Usage:
 *   npm run oslo:bydel-map
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { normalizeOsloBorough } from '../lib/osloBoroughs';

const SOURCE_URL =
  'https://www.erikbolstad.no/postnummer-koordinatar/kommune.php?kommunenummer=301';

type Row = {
  postalCode: string;
  usage: string;
  borough: string;
  lat?: number;
  lon?: number;
};

function stripTags(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(input: string): string {
  return input
    .replace(/&aring;/gi, 'å')
    .replace(/&Aring;/g, 'Å')
    .replace(/&aelig;/gi, 'æ')
    .replace(/&AElig;/g, 'Æ')
    .replace(/&oslash;/gi, 'ø')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/gi, '"');
}

function parseRows(html: string): Row[] {
  const rows: Row[] = [];
  const rowRegex = /<tr class='([^']*)'>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(html)) !== null) {
    const trClass = match[1] ?? '';
    const rowHtml = match[2] ?? '';
    if (trClass.includes('ikkjeibruk')) continue;

    const cells = [...rowHtml.matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
    if (cells.length < 4) continue;

    const postalHeader = decodeHtml(stripTags(cells[0] ?? ''));
    const postalMatch = postalHeader.match(/\b(\d{4})\b/);
    if (!postalMatch) continue;
    const postalCode = postalMatch[1];

    const usage = decodeHtml(stripTags(cells[1] ?? ''));
    const boroughRaw = decodeHtml(stripTags(cells[3] ?? ''));
    if (!boroughRaw) continue;

    // Keep only address-like postal codes for bydel mapping.
    const usageLower = usage.toLowerCase();
    if (usageLower.includes('ikkje i bruk')) continue;
    if (usageLower.includes('postboks')) continue;
    if (usageLower.includes('servicepostnummer')) continue;

    const coordsText = decodeHtml(stripTags(cells[2] ?? '')).replace(/\?/g, '');
    const coordMatch = coordsText.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);

    rows.push({
      postalCode,
      usage,
      borough: boroughRaw,
      lat: coordMatch ? Number(coordMatch[1]) : undefined,
      lon: coordMatch ? Number(coordMatch[2]) : undefined,
    });
  }

  // Deduplicate on postal code, prefer rows with recognized borough names.
  const dedup = new Map<string, Row>();
  for (const row of rows) {
    const existing = dedup.get(row.postalCode);
    const rowCanonical = normalizeOsloBorough(row.borough);
    const existingCanonical = existing ? normalizeOsloBorough(existing.borough) : null;

    if (!existing) {
      dedup.set(row.postalCode, row);
      continue;
    }
    if (!existingCanonical && rowCanonical) {
      dedup.set(row.postalCode, row);
      continue;
    }
  }

  return [...dedup.values()].sort((a, b) => a.postalCode.localeCompare(b.postalCode));
}

async function main() {
  console.log('Bygger Oslo postnummer -> bydel mapping...');
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'settdegetmal.no/1.0 (+local tooling)' },
  });
  if (!response.ok) {
    throw new Error(`Kunne ikke hente kilde: ${response.status}`);
  }

  const html = await response.text();
  const rows = parseRows(html);
  const recognized = rows.filter((r) => normalizeOsloBorough(r.borough)).length;

  const outDir = join(process.cwd(), 'data', 'reference');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'oslo-postnummer-bydeler.json');

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        source: SOURCE_URL,
        generatedAt: new Date().toISOString(),
        notes: 'Generated from Erik Bolstad postal code page for Oslo kommune (301). Postboks/servicepostnummer filtered out.',
        rows,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`Skrev ${rows.length} rader til ${outPath}`);
  console.log(`Gjenkjente bydeler: ${recognized}/${rows.length}`);
}

main().catch((err) => {
  console.error('Feil:', err);
  process.exit(1);
});
