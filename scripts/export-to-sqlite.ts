#!/usr/bin/env tsx
/**
 * Export Brønnøysund data to SQLite + CSV (no PostgreSQL needed)
 *
 * Usage:
 *   npm run brreg:export
 */

import { BrregDownloader, formatBytes } from '../lib/brreg/downloader';
import { isRelevantEntity } from '../lib/brreg/filter';
import { mapEntityToRow, calculateQualityScore } from '../lib/brreg/mapper';
import type { BrregEnhet } from '../lib/brreg/types';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import Database from 'better-sqlite3';

// Parse CLI args
const args = process.argv.slice(2);
const skipDownload = args.includes('--skip-download');

async function main() {
  console.log('🚀 Starting Brønnøysund export to SQLite + CSV');
  console.log();

  const downloader = new BrregDownloader({
    onProgress: (progress) => {
      const pct = progress.percentage.toString().padStart(3, ' ');
      const downloaded = formatBytes(progress.downloadedBytes).padStart(10, ' ');
      const total = formatBytes(progress.totalBytes).padStart(10, ' ');
      process.stdout.write(`\r⬇️  Downloading: ${pct}% (${downloaded} / ${total})`);
    },
  });

  // Download or use existing
  let filePath: string;
  if (skipDownload) {
    const { readdirSync } = await import('fs');
    const dataDir = join(process.cwd(), 'data', 'brreg');
    const files = readdirSync(dataDir).filter((f) => f.startsWith('enheter-') && f.endsWith('.json'));
    if (files.length === 0) {
      throw new Error('No existing files found. Remove --skip-download');
    }
    filePath = join(dataDir, files.sort().reverse()[0]);
    console.log(`📂 Using existing file: ${filePath}`);
  } else {
    console.log('📥 Downloading bulk file from Brønnøysundregisteret...');
    filePath = await downloader.downloadBulkFile();
    process.stdout.write('\n');
  }

  // Parse and filter
  console.log('🔍 Parsing and filtering entities...');
  const relevantEntities: BrregEnhet[] = [];
  let totalParsed = 0;

  for await (const entity of downloader.parseJsonLines(filePath)) {
    totalParsed++;

    if (isRelevantEntity(entity)) {
      relevantEntities.push(entity);
    }

    if (totalParsed % 10000 === 0) {
      process.stdout.write(`\r   Parsed: ${totalParsed.toLocaleString()}, Relevant: ${relevantEntities.length.toLocaleString()}`);
    }
  }

  process.stdout.write('\n');
  console.log(`✓ Found ${relevantEntities.length.toLocaleString()} relevant entities out of ${totalParsed.toLocaleString()}`);

  // Map to database format
  console.log('🗺️  Mapping to database format...');
  const rows = relevantEntities.map(mapEntityToRow).map(row => ({
    ...row,
    quality_score: calculateQualityScore(row),
  }));

  // Setup output directory
  const outputDir = join(process.cwd(), 'data', 'brreg');
  await mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().split('T')[0];

  // Export to SQLite
  console.log('💾 Exporting to SQLite...');
  const sqlitePath = join(outputDir, `export-${timestamp}.sqlite`);
  const db = new Database(sqlitePath);

  // Create table
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      orgnr TEXT PRIMARY KEY,
      navn TEXT NOT NULL,
      organisasjonsform TEXT,
      naeringskode1_kode TEXT,
      naeringskode1_beskrivelse TEXT,
      naeringskode2_kode TEXT,
      naeringskode2_beskrivelse TEXT,
      category TEXT,
      relevance_score INTEGER,
      quality_score INTEGER,
      antall_ansatte INTEGER,
      hjemmeside TEXT,
      forretningsadresse_adresse TEXT,
      forretningsadresse_postnummer TEXT,
      forretningsadresse_poststed TEXT,
      forretningsadresse_kommune TEXT,
      forretningsadresse_kommunenummer TEXT,
      forretningsadresse_land TEXT,
      postadresse_adresse TEXT,
      postadresse_postnummer TEXT,
      postadresse_poststed TEXT,
      postadresse_kommune TEXT,
      postadresse_kommunenummer TEXT,
      postadresse_land TEXT,
      registrert_i_mvaregisteret INTEGER,
      registrert_i_foretaksregisteret INTEGER,
      registrert_i_stiftelsesregisteret INTEGER,
      registrert_i_frivillighetsregisteret INTEGER,
      konkurs INTEGER,
      under_avvikling INTEGER,
      under_tvangsavvikling_eller_tvangsopplosning INTEGER,
      overordnet_enhet TEXT,
      maalform TEXT,
      registreringsdato_enhetsregisteret TEXT,
      stiftelsesdato TEXT,
      oppstartsdato TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_category ON entities(category);
    CREATE INDEX IF NOT EXISTS idx_relevance ON entities(relevance_score DESC);
    CREATE INDEX IF NOT EXISTS idx_quality ON entities(quality_score DESC);
    CREATE INDEX IF NOT EXISTS idx_nace ON entities(naeringskode1_kode);
    CREATE INDEX IF NOT EXISTS idx_poststed ON entities(forretningsadresse_poststed);
  `);

  // Insert data
  const insert = db.prepare(`
    INSERT OR REPLACE INTO entities VALUES (
      @orgnr, @navn, @organisasjonsform,
      @naeringskode1_kode, @naeringskode1_beskrivelse,
      @naeringskode2_kode, @naeringskode2_beskrivelse,
      @category, @relevance_score, @quality_score,
      @antall_ansatte, @hjemmeside,
      @forretningsadresse_adresse, @forretningsadresse_postnummer,
      @forretningsadresse_poststed, @forretningsadresse_kommune,
      @forretningsadresse_kommunenummer, @forretningsadresse_land,
      @postadresse_adresse, @postadresse_postnummer,
      @postadresse_poststed, @postadresse_kommune,
      @postadresse_kommunenummer, @postadresse_land,
      @registrert_i_mvaregisteret, @registrert_i_foretaksregisteret,
      @registrert_i_stiftelsesregisteret, @registrert_i_frivillighetsregisteret,
      @konkurs, @under_avvikling,
      @under_tvangsavvikling_eller_tvangsopplosning,
      @overordnet_enhet, @maalform,
      @registreringsdato_enhetsregisteret, @stiftelsesdato, @oppstartsdato
    )
  `);

  // Helper to normalize value to SQLite-compatible type
  const toSqlValue = (val: any): string | number | null => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return String(val);
  };

  const insertMany = db.transaction((entities: any[]) => {
    for (const entity of entities) {
      insert.run({
        orgnr: toSqlValue(entity.orgnr),
        navn: toSqlValue(entity.navn),
        organisasjonsform: toSqlValue(entity.organisasjonsform),
        naeringskode1_kode: toSqlValue(entity.naeringskode1_kode),
        naeringskode1_beskrivelse: toSqlValue(entity.naeringskode1_beskrivelse),
        naeringskode2_kode: toSqlValue(entity.naeringskode2_kode),
        naeringskode2_beskrivelse: toSqlValue(entity.naeringskode2_beskrivelse),
        category: toSqlValue(entity.category),
        relevance_score: toSqlValue(entity.relevance_score),
        quality_score: toSqlValue(entity.quality_score),
        antall_ansatte: toSqlValue(entity.antall_ansatte),
        hjemmeside: toSqlValue(entity.hjemmeside),
        forretningsadresse_adresse: toSqlValue(entity.forretningsadresse_adresse),
        forretningsadresse_postnummer: toSqlValue(entity.forretningsadresse_postnummer),
        forretningsadresse_poststed: toSqlValue(entity.forretningsadresse_poststed),
        forretningsadresse_kommune: toSqlValue(entity.forretningsadresse_kommune),
        forretningsadresse_kommunenummer: toSqlValue(entity.forretningsadresse_kommunenummer),
        forretningsadresse_land: toSqlValue(entity.forretningsadresse_land),
        postadresse_adresse: toSqlValue(entity.postadresse_adresse),
        postadresse_postnummer: toSqlValue(entity.postadresse_postnummer),
        postadresse_poststed: toSqlValue(entity.postadresse_poststed),
        postadresse_kommune: toSqlValue(entity.postadresse_kommune),
        postadresse_kommunenummer: toSqlValue(entity.postadresse_kommunenummer),
        postadresse_land: toSqlValue(entity.postadresse_land),
        registrert_i_mvaregisteret: entity.registrert_i_mvaregisteret ? 1 : 0,
        registrert_i_foretaksregisteret: entity.registrert_i_foretaksregisteret ? 1 : 0,
        registrert_i_stiftelsesregisteret: entity.registrert_i_stiftelsesregisteret ? 1 : 0,
        registrert_i_frivillighetsregisteret: entity.registrert_i_frivillighetsregisteret ? 1 : 0,
        konkurs: entity.konkurs ? 1 : 0,
        under_avvikling: entity.under_avvikling ? 1 : 0,
        under_tvangsavvikling_eller_tvangsopplosning: entity.under_tvangsavvikling_eller_tvangsopplosning ? 1 : 0,
        overordnet_enhet: toSqlValue(entity.overordnet_enhet),
        maalform: toSqlValue(entity.maalform),
        registreringsdato_enhetsregisteret: toSqlValue(entity.registreringsdato_enhetsregisteret),
        stiftelsesdato: toSqlValue(entity.stiftelsesdato),
        oppstartsdato: toSqlValue(entity.oppstartsdato),
      });
    }
  });

  insertMany(rows);
  db.close();

  console.log(`✓ Exported ${rows.length.toLocaleString()} entities to ${sqlitePath}`);

  // Export to CSV
  console.log('📄 Exporting to CSV...');
  const csvPath = join(outputDir, `export-${timestamp}.csv`);

  // CSV header
  const header = [
    'orgnr', 'navn', 'category', 'relevance_score', 'quality_score',
    'naeringskode1_kode', 'naeringskode1_beskrivelse',
    'antall_ansatte', 'hjemmeside',
    'forretningsadresse', 'postnummer', 'poststed', 'kommune',
    'registrert_i_mvaregisteret', 'organisasjonsform'
  ].join(',');

  // Helper for CSV escaping
  const toCsvField = (val: any): string => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // CSV rows
  const csvRows = rows.map(row => {
    const fields = [
      toCsvField(row.orgnr),
      toCsvField(row.navn),
      toCsvField(row.category),
      toCsvField(row.relevance_score),
      toCsvField(row.quality_score),
      toCsvField(row.naeringskode1_kode),
      toCsvField(row.naeringskode1_beskrivelse),
      toCsvField(row.antall_ansatte),
      toCsvField(row.hjemmeside),
      toCsvField(row.forretningsadresse_adresse),
      toCsvField(row.forretningsadresse_postnummer),
      toCsvField(row.forretningsadresse_poststed),
      toCsvField(row.forretningsadresse_kommune),
      row.registrert_i_mvaregisteret ? '1' : '0',
      toCsvField(row.organisasjonsform_kode)
    ];
    return fields.join(',');
  });

  await writeFile(csvPath, [header, ...csvRows].join('\n'));
  console.log(`✓ Exported ${rows.length.toLocaleString()} entities to ${csvPath}`);

  // Statistics
  console.log('\n📊 Statistics:');
  console.log(`   Total parsed: ${totalParsed.toLocaleString()}`);
  console.log(`   Relevant: ${rows.length.toLocaleString()}`);
  console.log(`   Filter rate: ${((rows.length / totalParsed) * 100).toFixed(2)}%`);

  const categories = rows.reduce((acc, row) => {
    const cat = row.category || 'unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n   By category:');
  Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`   - ${cat}: ${count.toLocaleString()}`);
  });

  const avgRelevance = Math.round(rows.reduce((sum, row) => sum + (row.relevance_score || 0), 0) / rows.length);
  const avgQuality = Math.round(rows.reduce((sum, row) => sum + (row.quality_score || 0), 0) / rows.length);
  console.log(`\n   Average relevance: ${avgRelevance}/100`);
  console.log(`   Average quality: ${avgQuality}/100`);

  console.log('\n✅ Export completed!');
  console.log('\n💡 Usage:');
  console.log(`   SQLite: Open ${sqlitePath} in DB Browser for SQLite`);
  console.log(`   CSV: Open ${csvPath} in Excel or Google Sheets`);
  console.log(`   SQL: SELECT * FROM entities WHERE category = 'gym' ORDER BY relevance_score DESC`);
}

main().catch(error => {
  console.error('❌ Export failed:', error);
  process.exit(1);
});
