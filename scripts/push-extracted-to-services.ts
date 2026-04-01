/**
 * push-extracted-to-services.ts
 *
 * Leser data/extracted.jsonl og oppdaterer services-tabellen i Supabase
 * med telefon og e-post hentet fra nettsidene.
 *
 * Bruk:
 *   npm run brreg:push-extracted
 *   npm run brreg:push-extracted -- --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type ExtractedRow = {
  orgnr: string;
  url: string;
  status: string;
  phones: string[];
  emails: string[];
  postal_code: string | null;
  city: string | null;
  address_line: string | null;
  type_hints: string[];
  raw_length: number;
};

type ServiceUpdate = {
  orgnr: string;
  phone?: string;
  email?: string;
};

async function main() {
  const filePath = resolve('data/extracted.jsonl');

  console.log('📤 push-extracted-to-services');
  console.log(`   Kilde  : ${filePath}`);
  console.log(`   Modus  : ${DRY_RUN ? 'DRY RUN (ingen skriving)' : 'LIVE'}\n`);

  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  const updates: ServiceUpdate[] = [];
  let total = 0;
  let withPhone = 0;
  let withEmail = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    total++;

    const row: ExtractedRow = JSON.parse(line);

    const phone = row.phones[0] ?? null;
    const email = row.emails[0] ?? null;

    if (!phone && !email) {
      skipped++;
      continue;
    }

    const update: ServiceUpdate = { orgnr: row.orgnr };
    if (phone) { update.phone = phone; withPhone++; }
    if (email) { update.email = email; withEmail++; }

    updates.push(update);
  }

  console.log(`   Lest   : ${total} rader`);
  console.log(`   Med tlf: ${withPhone}`);
  console.log(`   Med epost: ${withEmail}`);
  console.log(`   Uten data: ${skipped}\n`);

  if (DRY_RUN) {
    console.log('🔍 Dry run – eksempel på første 5 oppdateringer:');
    updates.slice(0, 5).forEach(u => console.log('  ', JSON.stringify(u)));
    console.log('\nKjør uten --dry-run for å skrive til Supabase.');
    return;
  }

  // Push in batches
  let pushed = 0;
  let errors = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    // Update each row by orgnr
    const promises = batch.map(u => {
      const fields: Record<string, string> = {};
      if (u.phone) fields.phone = u.phone;
      if (u.email) fields.email = u.email;

      return supabase
        .from('services')
        .update(fields)
        .eq('orgnr', u.orgnr);
    });

    const results = await Promise.all(promises);
    results.forEach(({ error }) => {
      if (error) errors++;
      else pushed++;
    });

    process.stdout.write(`\r   Oppdatert: ${pushed} / ${updates.length}  (feil: ${errors})`);
  }

  console.log(`\n\n✅ Ferdig!`);
  console.log(`   Oppdatert: ${pushed}`);
  console.log(`   Feil     : ${errors}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
