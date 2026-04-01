#!/usr/bin/env tsx
/**
 * Import BRREG entities from local SQLite → Supabase services + service_coverage
 *
 * Usage:
 *   npm run brreg:sqlite-import
 *   npm run brreg:sqlite-import -- --dry-run
 *   npm run brreg:sqlite-import -- --limit=100
 *   npm run brreg:sqlite-import -- --categories=gym,pt,yoga
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { join } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { lookupOsloBoroughByPostalCode } from '../lib/osloBoroughs';


// Load .env.local manually (no dotenv dependency)
try {
  const envPath = join(process.cwd(), '.env.local');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found – rely on shell env
}

// CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null;
const categoriesArg = args.find((a) => a.startsWith('--categories='))?.split('=')[1];
const categories = categoriesArg
  ? categoriesArg.split(',')
  : ['gym', 'pt', 'yoga', 'sports', 'physio', 'rehab'];

// Quality score thresholds per category
const QUALITY_THRESHOLD: Record<string, number> = {
  gym: 50,
  pt: 50,
  yoga: 50,
  sports: 60, // høyere terskel for idrettslag (mange lavkvalitets)
  physio: 55,
  rehab: 50,
};

// Map SQLite category → services.type
const TYPE_MAP: Record<string, string> = {
  gym: 'styrke',
  pt: 'pt',
  yoga: 'yoga',
  sports: 'sport',
  physio: 'spesialisert',
  rehab: 'spesialisert',
};

// Default goals per category
const GOALS_MAP: Record<string, string[]> = {
  gym: ['strength', 'endurance', 'weight_loss'],
  pt: ['strength', 'weight_loss', 'start'],
  yoga: ['mobility', 'endurance', 'start'],
  sports: ['endurance', 'strength', 'start'],
  physio: ['mobility', 'rehab'],
  rehab: ['rehab', 'mobility'],
};

// Default venues per category
const VENUES_MAP: Record<string, string[]> = {
  gym: ['gym'],
  pt: ['home', 'gym'],
  yoga: ['gym'],
  sports: ['gym'],
  physio: ['gym'],
  rehab: ['gym'],
};

type SqliteRow = {
  orgnr: string;
  navn: string;
  category: string;
  relevance_score: number;
  quality_score: number;
  naeringskode1_kode: string | null;
  naeringskode1_beskrivelse: string | null;
  antall_ansatte: number | null;
  hjemmeside: string | null;
  forretningsadresse_adresse: string | null;
  forretningsadresse_postnummer: string | null;
  forretningsadresse_poststed: string | null;
  forretningsadresse_kommune: string | null;
  registrert_i_mvaregisteret: number;
};

function normalizeCity(city: string | null): string | null {
  if (!city) return null;
  return city.toLowerCase().trim();
}

function buildDescription(row: SqliteRow): string {
  const city = row.forretningsadresse_poststed
    ? row.forretningsadresse_poststed.charAt(0) + row.forretningsadresse_poststed.slice(1).toLowerCase()
    : null;
  const nace = row.naeringskode1_beskrivelse;
  if (city && nace) return `${nace} i ${city}.`;
  if (city) return `Treningsvirksomhet i ${city}.`;
  return nace ?? '';
}

function buildTags(row: SqliteRow): string[] {
  const tags: string[] = [`orgnr:${row.orgnr}`];
  if (row.antall_ansatte && row.antall_ansatte >= 20) tags.push('stor_virksomhet');
  if (row.registrert_i_mvaregisteret) tags.push('mva_registrert');
  const name = row.navn.toLowerCase();
  if (name.includes('dame') || name.includes('kvinne')) tags.push('kun_damer');
  if (name.includes('senior')) tags.push('senior_vennlig');
  if (name.includes('nybegynner') || name.includes('beginner')) tags.push('nybegynner_vennlig');
  if (name.includes('crossfit')) tags.push('crossfit');
  if (name.includes('pilates')) tags.push('pilates');
  if (name.includes('online') || name.includes('digital')) tags.push('online');
  return tags;
}

function isExplicitDigitalOffer(row: SqliteRow): boolean {
  const haystack = [
    row.navn,
    row.hjemmeside,
    row.naeringskode1_beskrivelse,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    haystack.includes('online') ||
    haystack.includes('digital') ||
    haystack.includes('virtuell') ||
    haystack.includes('remote')
  );
}

async function main() {
  console.log('🏋️  BRREG SQLite → Supabase services import');
  console.log(`   Kategorier: ${categories.join(', ')}`);
  console.log(`   Dry run: ${dryRun}`);
  console.log(`   Limit: ${limit ?? 'ingen'}`);
  console.log();

  // Find SQLite file
  const dataDir = join(process.cwd(), 'data', 'brreg');
  const sqliteFiles = readdirSync(dataDir).filter((f) => f.endsWith('.sqlite'));
  if (sqliteFiles.length === 0) {
    console.error('❌ Ingen SQLite-fil funnet i data/brreg/');
    process.exit(1);
  }
  const sqlitePath = join(dataDir, sqliteFiles.sort().reverse()[0]);
  console.log(`📂 Bruker: ${sqliteFiles.sort().reverse()[0]}`);

  const db = new Database(sqlitePath, { readonly: true });

  // Build query
  const placeholders = categories.map(() => '?').join(', ');
  const qualityCase = categories
    .map((c) => `WHEN category = '${c}' THEN ${QUALITY_THRESHOLD[c] ?? 50}`)
    .join(' ');

  let query = `
    SELECT
      orgnr, navn, category, relevance_score, quality_score,
      naeringskode1_kode, naeringskode1_beskrivelse, antall_ansatte,
      hjemmeside,
      forretningsadresse_adresse,
      forretningsadresse_postnummer, forretningsadresse_poststed,
      forretningsadresse_kommune,
      registrert_i_mvaregisteret
    FROM entities
    WHERE category IN (${placeholders})
      AND quality_score >= CASE ${qualityCase} ELSE 50 END
      AND (konkurs = 0 OR konkurs IS NULL)
      AND (under_avvikling = 0 OR under_avvikling IS NULL)
  `;
  if (limit) query += ` LIMIT ${limit}`;

  const rows = db.prepare(query).all(...categories) as SqliteRow[];
  console.log(`✓ Hentet ${rows.length.toLocaleString('nb-NO')} bedrifter fra SQLite`);

  // Category breakdown
  const breakdown: Record<string, number> = {};
  for (const row of rows) {
    breakdown[row.category] = (breakdown[row.category] ?? 0) + 1;
  }
  for (const [cat, count] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cat.padEnd(12)}: ${count.toLocaleString('nb-NO')}`);
  }
  console.log();

  if (dryRun) {
    console.log('🏃 Dry run – viser 3 eksempler:');
    rows.slice(0, 3).forEach((row, i) => {
      const city = normalizeCity(row.forretningsadresse_poststed);
      console.log(`\n${i + 1}. ${row.navn} (${row.orgnr})`);
      console.log(`   Type: ${TYPE_MAP[row.category]} | By: ${city ?? '-'} | Score: ${row.quality_score}`);
      console.log(`   Mål: ${GOALS_MAP[row.category]?.join(', ')}`);
      console.log(`   Beskrivelse: ${buildDescription(row)}`);
    });
    db.close();
    return;
  }

  // Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const BATCH = 200;
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  console.log('💾 Starter import til Supabase...');

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    // Build service rows (no 'id' – let DB generate on insert, preserve on update)
    const serviceRows = batch.map((row) => ({
      name: row.navn,
      type: TYPE_MAP[row.category] ?? 'pt',
      description: buildDescription(row),
      price_level: 'medium',
      goals: GOALS_MAP[row.category] ?? [],
      venues: VENUES_MAP[row.category] ?? ['gym'],
      coverage: [],
      tags: buildTags(row),
      owner_user_id: null,
      is_active: true,
      orgnr: row.orgnr,
      website: row.hjemmeside ?? null,
      city: normalizeCity(row.forretningsadresse_poststed),
      oslo_bydel:
        normalizeCity(row.forretningsadresse_poststed) === 'oslo'
          ? lookupOsloBoroughByPostalCode(row.forretningsadresse_postnummer) ?? null
          : null,
      address: row.forretningsadresse_adresse && row.forretningsadresse_postnummer
        ? `${row.forretningsadresse_adresse}, ${row.forretningsadresse_postnummer} ${row.forretningsadresse_poststed ?? ''}`
        : row.forretningsadresse_postnummer && row.forretningsadresse_poststed
        ? `${row.forretningsadresse_postnummer} ${row.forretningsadresse_poststed}`
        : null,
    }));

    // Upsert services (conflict on orgnr)
    const { data: inserted, error: serviceError } = await supabase
      .from('services')
      .upsert(serviceRows, { onConflict: 'orgnr', ignoreDuplicates: false })
      .select('id, orgnr, city');

    if (serviceError) {
      console.error(`\n❌ Batch ${Math.floor(i / BATCH) + 1} feilet:`, serviceError.message);
      errors += batch.length;
      continue;
    }

    imported += inserted?.length ?? 0;

    const orgnrToCategory = new Map(batch.map((row) => [row.orgnr, row.category]));
    const orgnrIsExplicitDigital = new Map(
      batch.map((row) => [row.orgnr, isExplicitDigitalOffer(row)])
    );

    // Build service_coverage rows.
    // Local-first categories should get city coverage only
    // (not automatic nationwide region coverage), except explicit digital offers.
    const allServiceIds = (inserted ?? []).map((s) => s.id);

    // Delete existing coverage for these service_ids, then re-insert
    if (allServiceIds.length > 0) {
      await supabase.from('service_coverage').delete().in('service_id', allServiceIds);
    }

    const cityRows = (inserted ?? [])
      .filter((s) => s.city)
      .map((s) => ({
        service_id: s.id,
        type: 'city',
        city: s.city,
      }));

    const regionRows = (inserted ?? [])
      .filter((s) => {
        const category = orgnrToCategory.get(s.orgnr) ?? '';
        if (category === 'sports') return false;
        if (category === 'yoga') return false;
        if (category === 'pt' && !orgnrIsExplicitDigital.get(s.orgnr)) return false;
        return true;
      })
      .map((s) => ({
        service_id: s.id,
        type: 'region',
        region: 'norway',
      }));

    const coverageRows = [...cityRows, ...regionRows];

    if (coverageRows.length > 0) {
      const { error: coverageError } = await supabase
        .from('service_coverage')
        .insert(coverageRows);

      if (coverageError) {
        // Non-fatal – service is still imported, just without coverage
        skipped += coverageRows.length;
      }
    }

    // Upsert service_types (many-to-many)
    const typeRows = (inserted ?? [])
      .map((s) => {
        const cat = orgnrToCategory.get(s.orgnr) ?? '';
        const mappedType = TYPE_MAP[cat];
        if (!mappedType) return null;
        return { service_id: s.id, type: mappedType, is_primary: true };
      })
      .filter((r): r is { service_id: string; type: string; is_primary: boolean } => r !== null);

    if (typeRows.length > 0) {
      await supabase
        .from('service_types')
        .upsert(typeRows, { onConflict: 'service_id,type', ignoreDuplicates: true });
    }

    process.stdout.write(
      `\r   Importert: ${imported.toLocaleString('nb-NO')} / ${rows.length.toLocaleString('nb-NO')} (${errors} feil)`
    );
  }

  process.stdout.write('\n');
  console.log();
  console.log('✅ Import fullført!');
  console.log(`   Importert   : ${imported.toLocaleString('nb-NO')}`);
  console.log(`   Feil        : ${errors}`);
  if (skipped > 0) console.log(`   Coverage-feil: ${skipped}`);

  db.close();
}

main().catch((err) => {
  console.error('❌ Uventet feil:', err);
  process.exit(1);
});
