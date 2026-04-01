#!/usr/bin/env tsx
/**
 * Eksporter orgnr + hjemmeside fra SQLite til en tekstfil.
 * Én bedrift per linje, tab-separert: orgnr\thjemmeside
 *
 * Usage:
 *   npx tsx scripts/export-websites.ts
 *   npx tsx scripts/export-websites.ts --out=data/websites.tsv
 *   npx tsx scripts/export-websites.ts --all   (inkluder bedrifter uten nettside)
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { readdirSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const includeAll = args.includes('--all');
const outArg = args.find((a) => a.startsWith('--out='))?.split('=')[1];
const outPath = outArg ? join(process.cwd(), outArg) : join(process.cwd(), 'data', 'websites.tsv');

const dataDir = join(process.cwd(), 'data', 'brreg');
const sqliteFiles = readdirSync(dataDir).filter((f) => f.endsWith('.sqlite'));
if (sqliteFiles.length === 0) {
  console.error('❌ Ingen SQLite-fil funnet i data/brreg/');
  process.exit(1);
}
const sqlitePath = join(dataDir, sqliteFiles.sort().reverse()[0]);
console.log(`📂 ${sqliteFiles.sort().reverse()[0]}`);

const db = new Database(sqlitePath, { readonly: true });

const query = includeAll
  ? `
    SELECT orgnr, hjemmeside
    FROM entities
    WHERE (konkurs = 0 OR konkurs IS NULL)
      AND (under_avvikling = 0 OR under_avvikling IS NULL)
    ORDER BY orgnr
  `
  : `
    SELECT orgnr, hjemmeside
    FROM entities
    WHERE hjemmeside IS NOT NULL
      AND hjemmeside != ''
      AND (konkurs = 0 OR konkurs IS NULL)
      AND (under_avvikling = 0 OR under_avvikling IS NULL)
    ORDER BY orgnr
  `;

type Row = { orgnr: string; hjemmeside: string | null };
const rows = db.prepare(query).all() as Row[];
db.close();

const lines = rows.map((r) => `${r.orgnr}\t${r.hjemmeside ?? ''}`);
writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');

const withSite = rows.filter((r) => r.hjemmeside).length;
console.log(`✅ ${rows.length.toLocaleString('nb-NO')} bedrifter → ${outPath}`);
console.log(`   Med hjemmeside : ${withSite.toLocaleString('nb-NO')}`);
console.log(`   Uten hjemmeside: ${(rows.length - withSite).toLocaleString('nb-NO')}`);
