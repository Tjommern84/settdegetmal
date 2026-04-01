#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const file = process.argv[2] ?? 'data/all_dups.json';
  const ids: string[] = JSON.parse(readFileSync(file, 'utf-8'));
  console.log(`Deleting ${ids.length} duplicate services from ${file}...`);

  const BATCH = 50;
  let deleted = 0;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error } = await sb.from('services').delete().in('id', batch);
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      deleted += batch.length;
      if (deleted % 500 === 0 || deleted === ids.length) {
        console.log(`Deleted ${deleted}/${ids.length}`);
      }
    }
  }

  const { count } = await sb.from('services').select('*', { count: 'exact', head: true });
  console.log(`Done. Total services remaining: ${count}`);
}

main().catch(console.error);
