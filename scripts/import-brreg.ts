#!/usr/bin/env tsx
/**
 * Import script for Brønnøysundregisteret data
 *
 * Usage:
 *   npm run brreg:import [options]
 *
 * Options:
 *   --limit <number>     Limit number of entities to import (for testing)
 *   --skip-download      Skip downloading, use existing file
 *   --skip-geocode       Skip geocoding step
 *   --dry-run            Don't actually insert to database
 */

import { createClient } from '@supabase/supabase-js';
import { BrregDownloader, formatBytes } from '../lib/brreg/downloader';
import { isRelevantEntity } from '../lib/brreg/filter';
import { mapEntityToRow, calculateQualityScore } from '../lib/brreg/mapper';
import { NominatimGeocoder } from '../lib/brreg/geocoder';
import type { BrregEnhet } from '../lib/brreg/types';

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  limit: parseInt(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '0') || undefined,
  skipDownload: args.includes('--skip-download'),
  skipGeocode: args.includes('--skip-geocode'),
  dryRun: args.includes('--dry-run'),
};

// Initialize Supabase (optional for dry run)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!options.dryRun && (!supabaseUrl || !serviceRoleKey)) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('Or run with --dry-run to test without database');
  process.exit(1);
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

async function main() {
  console.log('🚀 Starting Brønnøysundregisteret import');
  console.log('Options:', options);
  console.log();

  // Create import log entry (skip for dry run)
  let importId: number | null = null;

  if (!options.dryRun && supabase) {
    const { data: logEntry, error: logError } = await supabase
      .from('brreg_import_log')
      .insert({
        status: 'running',
        nace_codes: [],
        metadata: { options },
      })
      .select()
      .single();

    if (logError || !logEntry) {
      console.error('❌ Failed to create import log:', logError);
      process.exit(1);
    }

    importId = logEntry.id;
  }

  try {
    // Step 1: Download bulk file
    let filePath: string;
    if (options.skipDownload) {
      // Find most recent file
      const { readdirSync } = await import('fs');
      const { join } = await import('path');
      const dataDir = join(process.cwd(), 'data', 'brreg');
      const files = readdirSync(dataDir).filter((f) => f.startsWith('enheter-') && f.endsWith('.json'));
      if (files.length === 0) {
        throw new Error('No existing files found. Remove --skip-download');
      }
      filePath = join(dataDir, files.sort().reverse()[0]);
      console.log(`📂 Using existing file: ${filePath}`);
    } else {
      const downloader = new BrregDownloader({
        onProgress: (progress) => {
          const pct = progress.percentage.toString().padStart(3, ' ');
          const downloaded = formatBytes(progress.downloadedBytes).padStart(10, ' ');
          const total = formatBytes(progress.totalBytes).padStart(10, ' ');
          process.stdout.write(`\r⬇️  Downloading: ${pct}% (${downloaded} / ${total})`);
        },
      });
      filePath = await downloader.downloadBulkFile();
      process.stdout.write('\n');
    }

    // Step 2: Parse and filter
    console.log('🔍 Parsing and filtering entities...');
    const downloader = new BrregDownloader();
    const relevantEntities: BrregEnhet[] = [];
    let totalParsed = 0;

    for await (const entity of downloader.parseJsonLines(filePath)) {
      totalParsed++;

      if (isRelevantEntity(entity)) {
        relevantEntities.push(entity);

        if (options.limit && relevantEntities.length >= options.limit) {
          break;
        }
      }

      if (totalParsed % 10000 === 0) {
        process.stdout.write(`\r   Parsed: ${totalParsed.toLocaleString()}, Relevant: ${relevantEntities.length.toLocaleString()}`);
      }
    }

    process.stdout.write('\n');
    console.log(`✓ Found ${relevantEntities.length.toLocaleString()} relevant entities out of ${totalParsed.toLocaleString()}`);

    // Update log
    if (supabase && importId) {
      await supabase
        .from('brreg_import_log')
        .update({
          total_downloaded: totalParsed,
          total_filtered: relevantEntities.length,
        })
        .eq('id', importId);
    }

    // Step 3: Map to database format
    console.log('🗺️  Mapping to database format...');
    const rows = relevantEntities.map(mapEntityToRow);

    // Step 4: Insert to database (in batches)
    if (!options.dryRun && supabase) {
      console.log('💾 Inserting to database...');
      const batchSize = 500;
      let imported = 0;
      let updated = 0;
      let errors = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const { error } = await supabase.from('brreg_entities').upsert(
          batch.map((row) => ({
            ...row,
            quality_score: calculateQualityScore(row),
          })),
          {
            onConflict: 'orgnr',
            ignoreDuplicates: false,
          }
        );

        if (error) {
          console.error(`❌ Batch ${i / batchSize + 1} failed:`, error);
          errors += batch.length;
        } else {
          imported += batch.length;
        }

        process.stdout.write(`\r   Imported: ${imported.toLocaleString()} / ${rows.length.toLocaleString()}`);
      }

      process.stdout.write('\n');
      console.log(`✓ Imported ${imported.toLocaleString()} entities (${errors} errors)`);

      // Update log
      if (supabase && importId) {
        await supabase
          .from('brreg_import_log')
          .update({
            total_imported: imported,
            total_errors: errors,
          })
          .eq('id', importId);
      }

      // Step 5: Queue for geocoding
      if (!options.skipGeocode && supabase) {
        console.log('📍 Queueing for geocoding...');
        const orgnrs = rows.map((r) => r.orgnr);

        const { error: queueError } = await supabase.from('brreg_enrichment_queue').upsert(
          orgnrs.map((orgnr) => ({
            orgnr,
            needs_geocoding: true,
            priority: 50,
          })),
          { onConflict: 'orgnr' }
        );

        if (queueError) {
          console.error('❌ Failed to queue for geocoding:', queueError);
        } else {
          console.log(`✓ Queued ${orgnrs.length.toLocaleString()} entities for geocoding`);
        }
      }
    } else {
      console.log('🏃 Dry run - skipping database insert');
      console.log('Sample entities:');
      rows.slice(0, 3).forEach((row, i) => {
        console.log(`\n${i + 1}. ${row.navn} (${row.orgnr})`);
        console.log(`   Category: ${row.category}`);
        console.log(`   NACE: ${row.naeringskode1_kode} - ${row.naeringskode1_beskrivelse}`);
        console.log(`   Relevance: ${row.relevance_score}/100`);
      });
    }

    // Mark as completed
    if (supabase && importId) {
      await supabase.from('brreg_import_log').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', importId);
    }

    console.log('\n✅ Import completed successfully!');
  } catch (error) {
    console.error('\n❌ Import failed:', error);

    if (supabase && importId) {
      await supabase
        .from('brreg_import_log')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
        })
        .eq('id', importId);
    }

    process.exit(1);
  }
}

main();
