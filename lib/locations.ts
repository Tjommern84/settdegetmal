import { getServiceSupabase } from './serviceSupabase';

export type CachedLocation = {
  label: string;
  city?: string | null;
  country?: string | null;
  lat: number;
  lon: number;
  source: string;
};

export async function queryLocationsByLabel(
  query: string,
  limit = 5
): Promise<CachedLocation[]> {
  const client = getServiceSupabase();
  if (!client || !query) return [];
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const { data } = await client
    .from('locations')
    .select('label, city, country, lat, lon, source')
    .ilike('label', `${normalized}%`)
    .order('label')
    .limit(limit);
  return (data ?? []).map((row) => ({
    label: String(row.label ?? ''),
    city: row.city ?? null,
    country: row.country ?? null,
    lat: Number(row.lat ?? 0),
    lon: Number(row.lon ?? 0),
    source: String(row.source ?? 'nominatim'),
  }));
}

export async function cacheLocations(locations: CachedLocation[]): Promise<void> {
  const client = getServiceSupabase();
  if (!client || locations.length === 0) return;
  const rows = locations.map((location) => ({
    label: location.label,
    city: location.city ?? null,
    country: location.country ?? null,
    lat: location.lat,
    lon: location.lon,
    source: location.source,
  }));
  await client.from('locations').upsert(rows, {
    onConflict: 'label,lat,lon',
  });
}

export async function findLocationByCity(city: string): Promise<CachedLocation | null> {
  const client = getServiceSupabase();
  if (!client || !city) return null;
  const normalized = city.trim();
  if (!normalized) return null;
  const { data } = await client
    .from('locations')
    .select('label, city, country, lat, lon, source')
    .ilike('city', normalized)
    .limit(1);
  const item = data?.[0];
  if (!item) return null;
  return {
    label: String(item.label ?? ''),
    city: item.city ?? null,
    country: item.country ?? null,
    lat: Number(item.lat ?? 0),
    lon: Number(item.lon ?? 0),
    source: String(item.source ?? 'nominatim'),
  };
}
