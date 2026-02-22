#!/usr/bin/env tsx
/**
 * Geocode entities from the enrichment queue
 *
 * Usage:
 *   npm run brreg:geocode [options]
 *
 * Options:
 *   --limit <number>     Maximum entities to geocode in this run
 *   --priority <number>  Only geocode entities with priority >= this value
 */

import { createClient } from '@supabase/supabase-js';
import { NominatimGeocoder } from '../lib/brreg/geocoder';
import { calculateQualityScore } from '../lib/brreg/mapper';

const args = process.argv.slice(2);
const options = {
  limit: parseInt(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '100') || 100,
  priority: parseInt(args.find((arg) => arg.startsWith('--priority='))?.split('=')[1] || '0') || 0,
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log('📍 Starting geocoding process');
  console.log(`   Limit: ${options.limit}, Min priority: ${options.priority}`);
  console.log();

  // Fetch entities that need geocoding
  const { data: queue, error: queueError } = await supabase
    .from('brreg_enrichment_queue')
    .select('orgnr, priority')
    .eq('needs_geocoding', true)
    .gte('priority', options.priority)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(options.limit);

  if (queueError || !queue || queue.length === 0) {
    console.log('✓ No entities need geocoding');
    return;
  }

  console.log(`Found ${queue.length} entities to geocode`);

  // Fetch full entity data
  const orgnrs = queue.map((q) => q.orgnr);
  const { data: entities, error: entitiesError } = await supabase
    .from('brreg_entities')
    .select('orgnr, navn, forretningsadresse_adresse, forretningsadresse_postnummer, forretningsadresse_poststed, forretningsadresse_kommune')
    .in('orgnr', orgnrs);

  if (entitiesError || !entities) {
    console.error('❌ Failed to fetch entities:', entitiesError);
    return;
  }

  // Build addresses to geocode
  const geocoder = new NominatimGeocoder();
  const addresses = entities
    .map((entity) => {
      const address = geocoder.buildAddressString({
        adresse: entity.forretningsadresse_adresse || undefined,
        postnummer: entity.forretningsadresse_postnummer || undefined,
        poststed: entity.forretningsadresse_poststed || undefined,
        kommune: entity.forretningsadresse_kommune || undefined,
      });

      return address ? { id: entity.orgnr, address } : null;
    })
    .filter((item): item is { id: string; address: string } => item !== null);

  console.log(`Geocoding ${addresses.length} addresses...`);
  console.log('(This will take ~' + Math.ceil(addresses.length / 60) + ' minutes due to rate limiting)\n');

  // Geocode in batches
  let processed = 0;
  let successful = 0;
  let failed = 0;

  for (const item of addresses) {
    const result = await geocoder.geocode(item.address);

    processed++;
    process.stdout.write(`\r   Progress: ${processed}/${addresses.length} (${successful} successful, ${failed} failed)`);

    if (result) {
      // Update entity with location
      const { error: updateError } = await supabase
        .from('brreg_entities')
        .update({
          location: `POINT(${result.lon} ${result.lat})`,
          updated_at: new Date().toISOString(),
        })
        .eq('orgnr', item.id);

      if (updateError) {
        console.error(`\n❌ Failed to update ${item.id}:`, updateError);
        failed++;
      } else {
        successful++;

        // Recalculate quality score
        const { data: entity } = await supabase
          .from('brreg_entities')
          .select('*')
          .eq('orgnr', item.id)
          .single();

        if (entity) {
          const qualityScore = calculateQualityScore(entity);
          await supabase
            .from('brreg_entities')
            .update({ quality_score: qualityScore })
            .eq('orgnr', item.id);
        }
      }

      // Mark as geocoded in queue
      await supabase
        .from('brreg_enrichment_queue')
        .update({
          needs_geocoding: false,
          geocoding_attempted_at: new Date().toISOString(),
          geocoding_attempts: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('orgnr', item.id);
    } else {
      failed++;

      // Increment attempt counter
      await supabase
        .from('brreg_enrichment_queue')
        .update({
          geocoding_attempted_at: new Date().toISOString(),
          geocoding_attempts: supabase.rpc('increment', { row_id: item.id }),
          updated_at: new Date().toISOString(),
        })
        .eq('orgnr', item.id);
    }
  }

  process.stdout.write('\n\n');
  console.log('✅ Geocoding completed');
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${failed}`);
}

main().catch(console.error);
