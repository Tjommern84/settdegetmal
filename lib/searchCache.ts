import { createHash } from 'crypto';
import { trackEvent } from './analytics';
import { getServiceSupabase } from './serviceSupabase';

export type SearchCacheParams = {
  city: string | null;
  lat: number | null;
  lon: number | null;
  goal: string;
  serviceType: string;
  budget: string;
  venue: string;
  sort: string;
  query: string | null;
  limit: number;
};

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeCoordinate(value: number | undefined | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }
  return Number(value.toFixed(6));
}

export function normalizeSearchParams(params: {
  city?: string;
  lat?: number;
  lon?: number;
  goal?: string;
  serviceType?: string;
  budget?: string;
  venue?: string;
  sort?: string;
  query?: string;
  limit?: number;
}): SearchCacheParams {
  return {
    city: params.city ?? null,
    lat: normalizeCoordinate(params.lat),
    lon: normalizeCoordinate(params.lon),
    goal: params.goal ?? 'any',
    serviceType: params.serviceType ?? 'any',
    budget: params.budget ?? 'any',
    venue: params.venue ?? 'either',
    sort: params.sort ?? 'best_match',
    query: params.query?.trim() ? params.query.trim().toLowerCase() : null,
    limit: Math.min(Math.max(params.limit ?? 20, 1), 20),
  };
}

export function buildSearchCacheKey(params: SearchCacheParams) {
  const payload = JSON.stringify(params);
  const hash = createHash('sha256').update(payload).digest('hex');
  return {
    key: hash,
    prefix: hash.slice(0, 8),
    payload,
  };
}

const cacheClient = getServiceSupabase();

async function logCacheEvent(type: 'cache_hit' | 'cache_miss', cacheKeyPrefix: string) {
  await trackEvent({
    type,
    metadata: {
      keyType: 'search',
      cacheKeyPrefix,
    },
  });
}

export async function readSearchCache(cacheKey: string, cacheKeyPrefix: string): Promise<unknown | null> {
  if (!cacheClient) return null;
  try {
    const { data } = await cacheClient
      .from('search_cache')
      .select('response, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (!data?.response) {
      await logCacheEvent('cache_miss', cacheKeyPrefix);
      return null;
    }

    const expiresAt = new Date(data.expires_at);
    if (expiresAt <= new Date()) {
      await cacheClient.from('search_cache').delete().eq('cache_key', cacheKey);
      await logCacheEvent('cache_miss', cacheKeyPrefix);
      return null;
    }

    await logCacheEvent('cache_hit', cacheKeyPrefix);
    return data.response as unknown;
  } catch {
    return null;
  }
}

export async function writeSearchCache(cacheKey: string, cacheKeyPrefix: string, response: unknown) {
  if (!cacheClient) return;
  const expiresAt = new Date(Date.now() + SEARCH_CACHE_TTL_MS).toISOString();
  try {
    await cacheClient.from('search_cache').upsert(
      {
        cache_key: cacheKey,
        response,
        expires_at: expiresAt,
      },
      { onConflict: 'cache_key' }
    );
  } catch {
    // best-effort
  }
}

export async function clearSearchCache() {
  if (!cacheClient) return;
  try {
    await cacheClient.from('search_cache').delete().neq('cache_key', '');
  } catch {
    // best-effort
  }
}
