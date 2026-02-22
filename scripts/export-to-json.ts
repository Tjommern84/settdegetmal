#!/usr/bin/env tsx
/**
 * Export Brønnøysund data to JSON file (no database needed)
 *
 * Usage:
 *   npm run brreg:export
 */

import { BrregDownloader } from '../lib/brreg/downloader';
import { isRelevantEntity } from '../lib/brreg/filter';
import { mapEntityToRow, calculateQualityScore } from '../lib/brreg/mapper';
import type { BrregEnhet } from '../lib/brreg/types';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

async function main() {
  console.log('🚀 Starting Brønnøysund export to JSON');

  const downloader = new BrregDownloader({
    onProgress: (progress) => {
      const pct = progress.percentage.toString().padStart(3, ' ');
      process.stdout.write(`\r⬇️  Downloading: ${pct}%`);
    },
  });

  // Download
  console.log('📥 Downloading bulk file...');
  const filePath = await downloader.downloadBulkFile();
  process.stdout.write('\n');

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

  // Export to JSON
  console.log('💾 Exporting to JSON...');
  const outputDir = join(process.cwd(), 'data', 'brreg');
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = join(outputDir, `export-${timestamp}.json`);

  await writeFile(outputPath, JSON.stringify(rows, null, 2));

  console.log(`✅ Exported ${rows.length.toLocaleString()} entities to ${outputPath}`);

  // Statistics
  console.log('\n📊 Statistics:');
  const categories = rows.reduce((acc, row) => {
    const cat = row.category || 'unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count.toLocaleString()}`);
  });

  const avgRelevance = Math.round(rows.reduce((sum, row) => sum + (row.relevance_score || 0), 0) / rows.length);
  console.log(`\n   Average relevance: ${avgRelevance}/100`);
}

main().catch(error => {
  console.error('❌ Export failed:', error);
  process.exit(1);
});
