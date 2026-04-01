import { NextResponse } from 'next/server';
import { cacheLocations, queryLocationsByLabel, type CachedLocation } from '../../../lib/locations';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitStore = new Map<string, number[]>();

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
};

const isRateLimited = (ip: string) => {
  const now = Date.now();
  const timestamps = rateLimitStore.get(ip) ?? [];
  const windowed = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (windowed.length >= RATE_LIMIT_MAX) {
    return true;
  }
  windowed.push(now);
  rateLimitStore.set(ip, windowed);
  return false;
};

const parseCity = (address?: Record<string, unknown>) => {
  if (!address) return undefined;
  return (
    (address.city as string | undefined) ??
    (address.town as string | undefined) ??
    (address.village as string | undefined) ??
    (address.municipality as string | undefined)
  );
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();
  const ip = getClientIp(request);

  if (!query) {
    return NextResponse.json([]);
  }

  if (isRateLimited(ip)) {
    return NextResponse.json([], { status: 429 });
  }

  const cached = await queryLocationsByLabel(query, 5);
  if (cached.length > 0) {
    return NextResponse.json(cached);
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(
        query
      )}`,
      {
        headers: {
          'User-Agent': 'settdegetmal/1.0 (settdegetmal.no)',
        },
      }
    );
    if (!response.ok) {
      return NextResponse.json([]);
    }
    const body = (await response.json()) as Array<Record<string, unknown>>;
    const results: CachedLocation[] = body
      .filter((item) => item.lat && item.lon && item.display_name)
      .slice(0, 5)
      .map((item) => ({
        label: String(item.display_name),
        lat: Number(item.lat),
        lon: Number(item.lon),
        city: parseCity(item.address as Record<string, unknown>),
        country: (item.address as Record<string, unknown> | undefined)?.country_code
          ? String(
              ((item.address as Record<string, unknown>)?.country_code as string).toUpperCase()
            )
          : undefined,
        source: 'nominatim',
      }));
    if (results.length > 0) {
      await cacheLocations(results);
    }
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
