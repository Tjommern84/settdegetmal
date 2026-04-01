import { supabase } from './supabaseClient';
import type { Service } from './domain';
import type { RankedService } from './matching';

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
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  orgnr: string | null;
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
    address: row.address ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    orgnr: row.orgnr ?? null,
  },
  distanceKm: row.distance_km ?? undefined,
  score: row.score,
  reasons: row.reasons ?? [],
  matchReason: row.match_reason ?? '',
});

export type SearchParams = {
  type?: string;
  venue?: string;
  city?: string;
  borough?: string;
  lat?: number;
  lon?: number;
  sort?: string;
  query?: string;
  tag?: string;
  mainCategory?: string;
  tags?: string[];
  limit?: number;
};

export async function searchServices(params: SearchParams): Promise<RankedService[]> {
  if (!supabase) return [];
  const baseArgs = {
    p_city: params.city ?? null,
    p_lat: params.lat ?? null,
    p_lon: params.lon ?? null,
    p_goal: 'any',
    p_service_type: params.type ?? 'any',
    p_budget: 'any',
    p_venue: params.venue && params.venue !== 'either' ? params.venue : null,
    p_sort: params.sort ?? 'best_match',
    p_query: params.query ?? null,
    p_tag: params.tag ?? null,
    p_main_category: params.mainCategory ?? null,
    p_tags: params.tags && params.tags.length > 0 ? params.tags : null,
    p_limit: params.limit ?? 50,
  };

  let data: unknown[] | null = null;
  let error: { message?: string; code?: string } | null = null;

  if (params.borough) {
    const withBorough = await supabase.rpc('search_services', {
      ...baseArgs,
      p_borough: params.borough,
    });
    data = withBorough.data as unknown[] | null;
    error = withBorough.error;

    const msg = `${error?.message ?? ''}`.toLowerCase();
    const shouldRetryWithoutBorough =
      !!error &&
      (msg.includes('p_borough') ||
        msg.includes('function search_services') ||
        msg.includes('could not find the function'));

    // Backward compatibility for prod environments where the SQL function
    // has not been updated to the new signature yet.
    if (shouldRetryWithoutBorough) {
      const legacy = await supabase.rpc('search_services', baseArgs);
      data = legacy.data as unknown[] | null;
      error = legacy.error;
    }
  } else {
    const res = await supabase.rpc('search_services', baseArgs);
    data = res.data as unknown[] | null;
    error = res.error;
  }

  if (error) throw error;

  return (Array.isArray(data) ? data : []).map((row) =>
    mapRowToRankedService(row as SearchServicesRow)
  );
}
