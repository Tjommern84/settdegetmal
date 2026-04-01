import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const OSLO_BOROUGHS = [
  'Alna',
  'Bjerke',
  'Frogner',
  'Gamle Oslo',
  'Grorud',
  'Gr\u00fcnerl\u00f8kka',
  'Nordre Aker',
  'Nordstrand',
  'Sagene',
  'St. Hanshaugen',
  'Stovner',
  'S\u00f8ndre Nordstrand',
  'Ullern',
  'Vestre Aker',
  '\u00d8stensj\u00f8',
] as const;

export type OsloBorough = (typeof OSLO_BOROUGHS)[number] | 'Sentrum';

const BOROUGH_ALIASES: Record<string, OsloBorough> = {
  alna: 'Alna',
  bjerke: 'Bjerke',
  frogner: 'Frogner',
  'gamle oslo': 'Gamle Oslo',
  grorud: 'Grorud',
  'gr\u00fcnerl\u00f8kka': 'Gr\u00fcnerl\u00f8kka',
  'gr\u00fcnerlokka': 'Gr\u00fcnerl\u00f8kka',
  grunerlokka: 'Gr\u00fcnerl\u00f8kka',
  'nordre aker': 'Nordre Aker',
  nordstrand: 'Nordstrand',
  sagene: 'Sagene',
  'st. hanshaugen': 'St. Hanshaugen',
  'st.hanshaugen': 'St. Hanshaugen',
  'st hanshaugen': 'St. Hanshaugen',
  'sankt hanshaugen': 'St. Hanshaugen',
  stovner: 'Stovner',
  's\u00f8ndre nordstrand': 'S\u00f8ndre Nordstrand',
  'sondre nordstrand': 'S\u00f8ndre Nordstrand',
  ullern: 'Ullern',
  'vestre aker': 'Vestre Aker',
  '\u00f8stensj\u00f8': '\u00d8stensj\u00f8',
  ostensjo: '\u00d8stensj\u00f8',
  sentrum: 'Sentrum',
};

export function normalizeOsloBorough(input: string | null | undefined): OsloBorough | null {
  if (!input) return null;
  const key = input.trim().toLowerCase().replace(/\s+/g, ' ');
  return BOROUGH_ALIASES[key] ?? null;
}

type OsloPostalBoroughMapFile = {
  rows: Array<{
    postalCode: string;
    borough: string;
  }>;
};

let cachedPostalMap: Map<string, OsloBorough> | null = null;

export function getOsloPostalCodeBoroughMap(): Map<string, OsloBorough> {
  if (cachedPostalMap) return cachedPostalMap;

  const filePath = join(process.cwd(), 'data', 'reference', 'oslo-postnummer-bydeler.json');
  const map = new Map<string, OsloBorough>();
  if (!existsSync(filePath)) {
    cachedPostalMap = map;
    return map;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as OsloPostalBoroughMapFile;
    for (const row of parsed.rows ?? []) {
      const borough = normalizeOsloBorough(row.borough);
      if (!borough) continue;
      if (/^\d{4}$/.test(row.postalCode)) map.set(row.postalCode, borough);
    }
  } catch {
    // Ignore malformed file.
  }

  cachedPostalMap = map;
  return map;
}

export function lookupOsloBoroughByPostalCode(
  postalCode: string | null | undefined
): OsloBorough | null {
  if (!postalCode) return null;
  const code = postalCode.trim();
  if (!/^\d{4}$/.test(code)) return null;
  return getOsloPostalCodeBoroughMap().get(code) ?? null;
}
