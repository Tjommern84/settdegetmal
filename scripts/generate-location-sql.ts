#!/usr/bin/env tsx
/**
 * Generer SQL for å oppdatere base_location på services som ble importert fra Google Places.
 * Output: sql/07_update_gym_locations.sql
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface GymPlace {
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
}
interface GymChainRecord {
  chain: string;
  places: GymPlace[];
}

function makeId(chain: string, address: string): string {
  return 'gp_' + `${chain}_${address}`
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function isNorwegianAddress(address: string): boolean {
  if (!address || address.trim().length < 5) return false;
  if (!/\b\d{4}\b/.test(address)) return false;
  if (/india|new delhi|stockholm|sweden|denmark|finland|berlin|london|paris/i.test(address)) return false;
  return true;
}

const inFile  = join(process.cwd(), 'data', 'gym-chains.jsonl');
const outFile = join(process.cwd(), 'sql', '07_update_gym_locations.sql');

const lines = readFileSync(inFile, 'utf-8').split('\n').filter(Boolean);
const updates: string[] = [];

for (const line of lines) {
  const record = JSON.parse(line) as GymChainRecord;
  for (const place of record.places) {
    if (!place.lat || !place.lon) continue;
    if (!isNorwegianAddress(place.address)) continue;
    const id = makeId(record.chain, place.address);
    updates.push(
      `UPDATE services SET base_location = ST_SetSRID(ST_MakePoint(${place.lon}, ${place.lat}), 4326) WHERE id = '${id.replace(/'/g, "''")}';`
    );
  }
}

const sql = [
  '-- Oppdater base_location for Google Places-importerte treningssentre',
  `-- Generert: ${new Date().toISOString()}`,
  `-- ${updates.length} lokasjoner`,
  '',
  ...updates,
  '',
].join('\n');

writeFileSync(outFile, sql, 'utf-8');
console.log(`✅ Genererte ${updates.length} UPDATE-setninger → ${outFile}`);
