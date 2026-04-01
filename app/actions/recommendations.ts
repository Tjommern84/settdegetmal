'use server';

import type { RankedService } from '../../lib/matching';
import { normalizeCity } from '../../lib/matching';
import { searchServices } from '../../lib/matchingDb';
import { logError } from '../../lib/errorLogger';
import { wrapServerAction } from '../../lib/actionWrapper';
import { getServiceSupabase } from '../../lib/serviceSupabase';
import type { Recommendation } from './recommendationTypes';
export type { Recommendation } from './recommendationTypes';

const parseNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const getSupabase = () => getServiceSupabase();

const normalizePreferenceValue = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'any') return null;
  return trimmed;
};

export const updateUserPreferencesFromSearch = wrapServerAction(
  'user_preferences_update',
  async (_prevState, formData: FormData) => {
    const accessToken = String(formData.get('accessToken') ?? '');
    if (!accessToken) {
      return { ok: false, message: 'Mangler innlogging for å lagre preferanser.' };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
    }

    const locationLabel = String(formData.get('locationLabel') ?? '');
    const lat = parseNumber(String(formData.get('lat') ?? ''));
    const lon = parseNumber(String(formData.get('lon') ?? ''));
    const goal = normalizePreferenceValue(String(formData.get('goal') ?? ''));
    const serviceType = normalizePreferenceValue(String(formData.get('serviceType') ?? ''));
    const budget = normalizePreferenceValue(String(formData.get('budget') ?? ''));
    const venue = normalizePreferenceValue(String(formData.get('venue') ?? ''));

    const { error } = await supabase.from('user_preferences').upsert({
      user_id: userData.user.id,
      last_location_label: locationLabel || null,
      last_lat: lat,
      last_lon: lon,
      last_goal: goal,
      last_service_type: serviceType,
      last_budget: budget,
      last_venue: venue,
      updated_at: new Date().toISOString(),
    } as any);

    if (error) {
      await logError({
        level: 'warn',
        source: 'server_action',
        context: 'update_user_preferences',
        message: error.message ?? 'Kunne ikke lagre brukerpreferanser.',
        metadata: { userId: userData.user.id },
      });
      return { ok: false, message: 'Kunne ikke lagre preferanser.' };
    }

    return { ok: true, message: 'Preferanser oppdatert.' };
  }
);

type RecommendationPayload = {
  locationLabel: string | null;
  recommendations: Recommendation[];
};

export async function getRecommendations(
  accessToken: string,
  limit = 5
): Promise<RecommendationPayload> {
  if (!accessToken) {
    return { locationLabel: null, recommendations: [] };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { locationLabel: null, recommendations: [] };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { locationLabel: null, recommendations: [] };
  }

  type UserPrefs = {
    last_location_label: string | null;
    last_lat: number | null;
    last_lon: number | null;
    last_goal: string | null;
    last_service_type: string | null;
    last_budget: string | null;
    last_venue: string | null;
  };

  const { data: preferences } = await supabase
    .from('user_preferences')
    .select(
      'last_location_label, last_lat, last_lon, last_goal, last_service_type, last_budget, last_venue'
    )
    .eq('user_id', userData.user.id)
    .maybeSingle() as { data: UserPrefs | null };

  if (!preferences) {
    return { locationLabel: null, recommendations: [] };
  }

  type EventRow = { type: string; service_id: string | null };

  const eventLimit = 25;
  const { data: events } = await supabase
    .from('events')
    .select('type, service_id')
    .eq('user_id', userData.user.id)
    .in('type', ['profile_viewed', 'result_clicked', 'lead_created'])
    .order('created_at', { ascending: false })
    .limit(eventLimit) as { data: EventRow[] | null };

  const queuedEvents = Array.isArray(events) ? events : [];
  const viewedServices = new Set<string>();
  const leadServices = new Set<string>();
  queuedEvents.forEach((event) => {
    const serviceId = event.service_id;
    if (!serviceId) return;
    if (event.type === 'lead_created') {
      leadServices.add(serviceId);
    } else {
      viewedServices.add(serviceId);
    }
  });

  const normalizedCity = normalizeCity(preferences.last_location_label ?? '');
  const searchParams = {
    city: normalizedCity || '',
    sortBy: 'best_match' as const,
    lat:
      typeof preferences.last_lat === 'number' && Number.isFinite(preferences.last_lat)
        ? preferences.last_lat
        : undefined,
    lon:
      typeof preferences.last_lon === 'number' && Number.isFinite(preferences.last_lon)
        ? preferences.last_lon
        : undefined,
    goal: normalizePreferenceValue(preferences.last_goal ?? undefined) ?? undefined,
    serviceType:
      normalizePreferenceValue(preferences.last_service_type ?? undefined) ?? undefined,
    budget: normalizePreferenceValue(preferences.last_budget ?? undefined) ?? undefined,
    venue: normalizePreferenceValue(preferences.last_venue ?? undefined) ?? undefined,
    limit: Math.max(limit * 2, 10),
  };

  let ranked: RankedService[] = [];
  try {
    ranked = await searchServices({ city: searchParams.city, lat: searchParams.lat, lon: searchParams.lon, type: searchParams.serviceType, limit: searchParams.limit, sort: searchParams.sortBy });
  } catch (error) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'get_recommendations',
      message: error instanceof Error ? error.message : 'Kunne ikke hente anbefalinger.',
      metadata: { userId: userData.user.id },
    });
    return { locationLabel: preferences.last_location_label ?? null, recommendations: [] };
  }

  const seenServices = new Set<string>([...viewedServices, ...leadServices]);
  const unique: Recommendation[] = [];
  const added = new Set<string>();

  for (const item of ranked) {
    const serviceId = item.service.id;
    if (seenServices.has(serviceId) || added.has(serviceId)) {
      continue;
    }

    const isViewed = viewedServices.has(serviceId);
    const closeBy = typeof item.distanceKm === 'number' && item.distanceKm < 5;
    const isCheaper =
      preferences.last_budget &&
      preferences.last_budget !== 'any' &&
      item.service.price_level === 'low' &&
      preferences.last_budget !== 'low';

    let reason = 'Anbefalt for deg';
    if (isViewed) {
      reason = 'Basert på det du så i går';
    } else if (closeBy) {
      reason = 'Nærmere deg';
    } else if (isCheaper) {
      reason = 'Lignende tilbud, men billigere';
    }

    unique.push({
      serviceId,
      name: item.service.name,
      description: item.service.description,
      priceLevel: item.service.price_level,
      ratingAvg: item.service.rating_avg,
      ratingCount: item.service.rating_count,
      matchReason: item.matchReason,
      distanceKm: item.distanceKm,
      reason,
    });
    added.add(serviceId);
    if (unique.length >= limit) break;
  }

  return {
    locationLabel: preferences.last_location_label ?? null,
    recommendations: unique,
  };
}
