/**
 * Geocoding via Nominatim (OpenStreetMap) – free, no API key required.
 * Results are cached in memory per process lifetime (Next.js server).
 */

type Coords = { lat: number; lon: number };

const cache = new Map<string, Coords | null>();

export async function geocodeNorwegianCity(city: string): Promise<Coords | null> {
  const key = city.toLowerCase().trim();
  if (!key) return null;

  if (cache.has(key)) return cache.get(key)!;

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(city)},Norway` +
      `&format=json&limit=1&countrycodes=no`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'settdegetmal.no/1.0' },
      next: { revalidate: 86400 }, // cache 24h in Next.js
    });

    if (!res.ok) {
      cache.set(key, null);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      cache.set(key, null);
      return null;
    }

    const coords: Coords = {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
    cache.set(key, coords);
    return coords;
  } catch {
    cache.set(key, null);
    return null;
  }
}
