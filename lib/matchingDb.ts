import { cache } from 'react';
import type { MatchParams, RankedService } from './matching';
import { cityCoordinates, normalizeCity } from './matching';
import { logError } from './errorLogger';
import { supabase } from './supabaseClient';
import type { Service } from './domain';
import { services as staticServices } from './providers';
const NEXT_CACHE_BUCKET_MS = 5 * 60 * 1000;

type MemoKeyPayload = {
  params: SearchCacheParams;
  searchCacheKey: string;
  cacheKeyPrefix: string;
  bucket: number;
};

const memoizedRankedServices = cache(async (memoKey: string): Promise<RankedService[]> => {
  const payload: MemoKeyPayload = JSON.parse(memoKey);
  return fetchRankedServices(payload.params, payload.searchCacheKey, payload.cacheKeyPrefix);
});
import type { SearchCacheParams } from './searchCache';
import {
  buildSearchCacheKey,
  normalizeSearchParams,
  readSearchCache,
  writeSearchCache,
} from './searchCache';

type SearchServicesRow = {
  service_id: string;
  name: string;
  type: Service['type'];
  description: string;
  coverage: Service['coverage'];
  price_level: Service['price_level'];
  rating_avg: number;
  rating_count: number;
  tags: string[];
  goals: Service['goals'];
  venues: Service['venues'];
  is_active: boolean;
  distance_km: number | null;
  score: number;
  reasons: string[] | null;
  match_reason: string | null;
};

const mapRowToRankedService = (row: SearchServicesRow): RankedService => ({
  service: {
    id: row.service_id,
    name: row.name,
    type: row.type,
    description: row.description,
    coverage: row.coverage ?? [],
    price_level: row.price_level,
    rating_avg: row.rating_avg ?? 0,
    rating_count: row.rating_count ?? 0,
    tags: row.tags ?? [],
    goals: row.goals ?? [],
    venues: row.venues ?? [],
    is_active: row.is_active ?? true,
  },
  distanceKm: row.distance_km ?? undefined,
  score: row.score,
  reasons: row.reasons ?? [],
  matchReason: row.match_reason ?? '',
});

async function fetchRankedServices(
  params: SearchCacheParams,
  searchCacheKey: string,
  cacheKeyPrefix: string
): Promise<RankedService[]> {
  const cached = await readSearchCache(searchCacheKey, cacheKeyPrefix);
  if (Array.isArray(cached)) {
    return (cached as SearchServicesRow[]).map((row) => mapRowToRankedService(row));
  }

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc('search_services', {
    p_city: params.city,
    p_lat: params.lat,
    p_lon: params.lon,
    p_goal: params.goal,
    p_service_type: params.serviceType,
    p_budget: params.budget,
    p_venue: params.venue,
    p_sort: params.sort,
    p_query: params.query,
    p_limit: params.limit,
  });

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? (data as SearchServicesRow[]) : [];
  await writeSearchCache(searchCacheKey, cacheKeyPrefix, rows);
  return rows.map((row) => mapRowToRankedService(row));
}

export type DbMatchParams = MatchParams & {
  lat?: number;
  lon?: number;
  limit?: number;
  query?: string;
};

export async function getRankedServicesFromDb(params: DbMatchParams): Promise<RankedService[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const normalizedCity = normalizeCity(params.city ?? '');
  const coords = normalizedCity ? cityCoordinates[normalizedCity] : null;
  const normalizedParams = normalizeSearchParams({
    city: normalizedCity || undefined,
    lat: params.lat ?? coords?.lat ?? undefined,
    lon: params.lon ?? coords?.lon ?? undefined,
    goal: params.goal,
    serviceType: params.serviceType,
    budget: params.budget,
    venue: params.venue,
    sort: params.sortBy,
    query: params.query,
    limit: params.limit,
  });
  const searchMeta = buildSearchCacheKey(normalizedParams);
  const memoKey = JSON.stringify({
    params: normalizedParams,
    searchCacheKey: searchMeta.key,
    cacheKeyPrefix: searchMeta.prefix,
    bucket: Math.floor(Date.now() / NEXT_CACHE_BUCKET_MS),
  });

  try {
    return await memoizedRankedServices(memoKey);
  } catch (error) {
    await logError({
      level: 'error',
      source: 'search_services',
      context: 'getRankedServicesFromDb',
      message: error instanceof Error ? error.message : 'DB matching failed',
      metadata: {
        params: normalizedParams,
        cacheKey: searchMeta.key,
      },
    });
    throw error;
  }
}

export async function fetchLegacyServices(): Promise<Service[]> {
  if (!supabase) {
    return staticServices;
  }
  const { data } = await supabase
    .from('services')
    .select(
      'id, name, type, description, coverage, price_level, rating_avg, rating_count, tags, goals, venues, is_active'
    )
    .eq('is_active', true)
    .limit(500);

  if (!data) {
    return staticServices;
  }

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    type: (row.type as Service['type']) ?? 'pt',
    description: String(row.description ?? ''),
    coverage: Array.isArray(row.coverage) ? (row.coverage as Service['coverage']) : [],
    price_level: (row.price_level as Service['price_level']) ?? 'medium',
    rating_avg: typeof row.rating_avg === 'number' ? row.rating_avg : Number(row.rating_avg ?? 0),
    rating_count:
      typeof row.rating_count === 'number' ? row.rating_count : Number(row.rating_count ?? 0),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    goals: Array.isArray(row.goals) ? (row.goals as Service['goals']) : [],
    venues: Array.isArray(row.venues) ? (row.venues as Service['venues']) : [],
    is_active: row.is_active !== false,
  }));
}
