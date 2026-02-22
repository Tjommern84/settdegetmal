'use server';

import { createClient } from '@supabase/supabase-js';
import { stripe, stripeConfig, isStripeConfigured } from '../../lib/stripe';
import { ENABLE_PAYMENTS } from '../../lib/featureFlags';
import { invalidateServiceCaches } from '../../lib/cacheInvalidation';
import { getServiceSupabase } from '../../lib/serviceSupabase';
import { logError } from '../../lib/errorLogger';
import { wrapServerAction } from '../../lib/actionWrapper';
import { AvailabilitySlot } from '../../lib/booking';

type OwnedService = {
  id: string;
  name: string;
  subscription_status?: 'inactive' | 'active' | 'past_due';
};

type LeadRow = {
  id: string;
  service_id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

type ServiceRow = {
  id: string;
  name: string;
  description: string;
  price_level: 'low' | 'medium' | 'high';
  goals: string[];
  venues: string[];
  coverage: unknown;
  tags: string[];
  owner_user_id: string | null;
  cover_image_url?: string | null;
  logo_image_url?: string | null;
  cancellation_hours?: number | null;
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function getOwnedServices(accessToken: string): Promise<OwnedService[]> {
  const supabase = getSupabase();
  if (!supabase || !accessToken) return [];

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return [];

  const { data } = await supabase
    .from('services')
    .select('id, name, subscription_status')
    .eq('owner_user_id', userData.user.id)
    .order('name');

  return data ?? [];
}

export async function getOwnedService(
  accessToken: string,
  serviceId: string
): Promise<ServiceRow | null> {
  const supabase = getSupabase();
  if (!supabase || !accessToken || !serviceId) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return null;

  const { data } = await supabase
    .from('services')
    .select(
      'id, name, description, price_level, goals, venues, coverage, tags, owner_user_id, cover_image_url, logo_image_url, cancellation_hours'
    )
    .eq('id', serviceId)
    .maybeSingle();

  if (!data || data.owner_user_id !== userData.user.id) return null;

  return data as ServiceRow;
}

export async function updateServiceProfile(
  _prevState: { ok: boolean; message: string },
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };

  const accessToken = String(formData.get('accessToken') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');

  if (!accessToken || !serviceId) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const priceLevel = String(formData.get('price_level') ?? '');
  const goals = formData.getAll('goals').map((value) => String(value));
  const venues = formData.getAll('venues').map((value) => String(value));
  const tagsRaw = String(formData.get('tags') ?? '');
  const tags = tagsRaw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  const cancellationHoursRaw = String(formData.get('cancellation_hours') ?? '24');
  const cancellationHours = Number(cancellationHoursRaw);
  if (Number.isNaN(cancellationHours) || cancellationHours < 0) {
    return { ok: false, message: 'Ugyldig avbestillingsfrist.' };
  }

  if (!name || !description) {
    return { ok: false, message: 'Navn og beskrivelse må fylles ut.' };
  }

  if (priceLevel !== 'low' && priceLevel !== 'medium' && priceLevel !== 'high') {
    return { ok: false, message: 'Ugyldig prisnivå.' };
  }

  const coverageType = String(formData.get('coverage_type') ?? '');
  type CoverageRule =
    | {
        type: 'radius';
        center: { lat: number; lon: number };
        radius_km: number;
      }
    | { type: 'cities'; cities: string[] }
    | { type: 'region'; region: 'norway' | 'nordic' };
  let coverage: CoverageRule[] = [];

  if (coverageType === 'radius') {
    const lat = Number(formData.get('coverage_lat') ?? '');
    const lon = Number(formData.get('coverage_lon') ?? '');
    const radius = Number(formData.get('coverage_radius') ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius)) {
      return { ok: false, message: 'Fyll inn gyldig radius-dekning.' };
    }
    coverage = [
      {
        type: 'radius',
        center: { lat, lon },
        radius_km: radius,
      },
    ];
  } else if (coverageType === 'cities') {
    const citiesRaw = String(formData.get('coverage_cities') ?? '');
    const cities = citiesRaw
      .split(',')
      .map((city) => city.trim())
      .filter((city) => city.length > 0);
    if (cities.length === 0) {
      return { ok: false, message: 'Oppgi minst én by.' };
    }
    coverage = [
      {
        type: 'cities',
        cities,
      },
    ];
  } else if (coverageType === 'region') {
    const region = String(formData.get('coverage_region') ?? '');
    if (region !== 'norway' && region !== 'nordic') {
      return { ok: false, message: 'Velg region.' };
    }
    coverage = [
      {
        type: 'region',
        region,
      },
    ];
  } else {
    return { ok: false, message: 'Velg dekningstype.' };
  }

  const { data: current } = await supabase
    .from('services')
    .select('owner_user_id')
    .eq('id', serviceId)
    .maybeSingle();

  if (!current || current.owner_user_id !== userData.user.id) {
    return { ok: false, message: 'Du har ikke tilgang til å oppdatere denne tjenesten.' };
  }

  const { error: updateError } = await supabase
    .from('services')
    .update({
      name,
      description,
      price_level: priceLevel,
      goals,
      venues,
      coverage,
      tags,
      cancellation_hours: cancellationHours,
    })
    .eq('id', serviceId);

  if (updateError) {
    return { ok: false, message: 'Kunne ikke lagre endringene.' };
  }

  const serviceClient = getServiceSupabase();
  if (serviceClient) {
    await serviceClient.from('service_coverage').delete().eq('service_id', serviceId);
    const coverageRows: any[] = (coverage as any[]).flatMap((rule: any) => {
      if (rule.type === 'radius') {
        return [
          {
            service_id: serviceId,
            type: 'radius',
            radius_center: `SRID=4326;POINT(${rule.center.lon} ${rule.center.lat})`,
            radius_km: rule.radius_km,
          },
        ];
      }
      if (rule.type === 'cities') {
        return rule.cities
          .filter((city: string) => city.trim().length > 0)
          .map((city: string) => ({
            service_id: serviceId,
            type: 'city',
            city,
          }));
      }
      return [
        {
          service_id: serviceId,
          type: 'region',
          region: rule.region,
        },
      ];
    });
  if (coverageRows.length > 0) {
    await serviceClient.from('service_coverage').insert(coverageRows as any);
  }
}

  await invalidateServiceCaches(serviceId);

  return { ok: true, message: 'Lagret.' };
}

const normalizeTime = (value: string): string | null => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;
};

const toMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
};

const parseSlots = (rawSlots: string): AvailabilitySlot[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawSlots);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const slots: AvailabilitySlot[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const weekday = Number((item as { weekday?: unknown }).weekday ?? 0);
    const start = normalizeTime(String((item as { start_time?: unknown }).start_time ?? ''));
    const end = normalizeTime(String((item as { end_time?: unknown }).end_time ?? ''));
    if (!Number.isFinite(weekday) || weekday < 1 || weekday > 7) continue;
    if (!start || !end) continue;
    if (toMinutes(end) <= toMinutes(start)) continue;
    slots.push({ weekday, start_time: start, end_time: end });
  }
  return slots.sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
    return a.end_time.localeCompare(b.end_time);
  });
};

export async function getAvailability(serviceId: string): Promise<AvailabilitySlot[]> {
  if (!serviceId) return [];
  const serviceClient = getServiceSupabase();
  if (!serviceClient) return [];
  const { data } = await serviceClient
    .from('provider_availability')
    .select('weekday, start_time, end_time')
    .eq('service_id', serviceId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true }) as { data: any[] | null };
  if (!Array.isArray(data)) return [];
  return data.map((row: any) => ({
    weekday: Number(row.weekday ?? 0),
    start_time: String(row.start_time ?? ''),
    end_time: String(row.end_time ?? ''),
  }));
}

const saveAvailabilityHandler = async (
  _prevState: { ok: boolean; message: string },
  formData: FormData
): Promise<{ ok: boolean; message: string }> => {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const accessToken = String(formData.get('accessToken') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');
  const slotsPayload = String(formData.get('slots') ?? '[]');

  if (!accessToken || !serviceId) {
    return { ok: false, message: 'Manglende data for tilgjengelighet.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: service } = await supabase
    .from('services')
    .select('owner_user_id')
    .eq('id', serviceId)
    .maybeSingle();

  if (!service || service.owner_user_id !== userData.user.id) {
    return { ok: false, message: 'Du har ikke tilgang til denne tjenesten.' };
  }

  const normalizedSlots = parseSlots(slotsPayload);
  const serviceClient = getServiceSupabase();
  if (!serviceClient) {
    return { ok: false, message: 'Kunne ikke koble til Supabase.' };
  }

  const { error: deleteError } = await serviceClient
    .from('provider_availability')
    .delete()
    .eq('service_id', serviceId);
  if (deleteError) {
    logError({
      level: 'error',
      source: 'server_action',
      context: 'save_availability_delete',
      message: deleteError.message ?? 'Kunne ikke rydde eksisterende tilgjengelighet.',
      metadata: { serviceId },
    });
    return { ok: false, message: 'Kunne ikke oppdatere tilgjengelighet.' };
  }

  if (normalizedSlots.length > 0) {
    const rows = normalizedSlots.map((slot) => ({
      service_id: serviceId,
      weekday: slot.weekday,
      start_time: slot.start_time,
      end_time: slot.end_time,
    }));
    const { error: insertError } = await serviceClient.from('provider_availability').insert(rows);
    if (insertError) {
      logError({
        level: 'error',
        source: 'server_action',
        context: 'save_availability_insert',
        message: insertError.message ?? 'Kunne ikke lagre tilgjengeligheten.',
        metadata: { serviceId },
      });
      return { ok: false, message: 'Kunne ikke lagre tilgjengeligheten.' };
    }
  }

  await invalidateServiceCaches(serviceId);

  return { ok: true, message: 'Tilgjengelighet lagret.' };
};

export const saveAvailability = wrapServerAction('service_availability_save', saveAvailabilityHandler);

export async function uploadServiceImage(formData: FormData): Promise<{
  ok: boolean;
  message: string;
  url?: string;
  kind?: 'cover' | 'logo';
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const accessToken = String(formData.get('accessToken') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');
  const kind = String(formData.get('kind') ?? '');
  const file = formData.get('file');

  if (!accessToken || !serviceId || !kind) {
    return { ok: false, message: 'Manglende opplastingsdata.' };
  }

  if (kind !== 'cover' && kind !== 'logo') {
    return { ok: false, message: 'Ugyldig bildetype.' };
  }

  if (!file || !(file instanceof Blob)) {
    return { ok: false, message: 'Velg en bildefil.' };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, message: 'Bildet må være mindre enn 5 MB.' };
  }

  const extension = ALLOWED_IMAGE_TYPES[file.type];
  if (!extension) {
    return { ok: false, message: 'Filtypen må være JPEG, PNG eller WebP.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: current } = await supabase
    .from('services')
    .select('owner_user_id')
    .eq('id', serviceId)
    .maybeSingle();

  if (!current || current.owner_user_id !== userData.user.id) {
    return { ok: false, message: 'Du har ikke tilgang til denne tjenesten.' };
  }

  const serviceClient = getServiceSupabase();
  if (!serviceClient) {
    return { ok: false, message: 'Kunne ikke koble til Supabase.' };
  }

  const path = `service/${serviceId}/${kind}.${extension}`;
  const storage = serviceClient.storage.from('service-media');
  const { error: uploadError } = await storage.upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return { ok: false, message: uploadError.message ?? 'Kunne ikke laste opp bildet.' };
  }

  const { data: urlData } = storage.getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) {
    return { ok: false, message: 'Kunne ikke hente bilde-URL.' };
  }

  const { error: updateError } = await serviceClient
    .from('services')
    .update(kind === 'cover' ? { cover_image_url: publicUrl } : { logo_image_url: publicUrl })
    .eq('id', serviceId);

  if (updateError) {
    return { ok: false, message: 'Kunne ikke lagre billedata.' };
  }

  await invalidateServiceCaches(serviceId);

  return { ok: true, message: 'Bildet er lastet opp.', url: publicUrl, kind: kind as 'cover' | 'logo' };
}

export async function createCheckoutSession(
  _prevState: { ok: boolean; message: string; url?: string },
  formData: FormData
): Promise<{ ok: boolean; message: string; url?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  if (!ENABLE_PAYMENTS || !isStripeConfigured || !stripe) {
    return { ok: false, message: 'Betaling er ikke aktivert ennå.' };
  }

  const accessToken = String(formData.get('accessToken') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');

  if (!accessToken || !serviceId) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  if (!stripeConfig.priceId) {
    return { ok: false, message: 'Mangler Stripe price id.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: service } = await supabase
    .from('services')
    .select('id, name, owner_user_id, stripe_customer_id, subscription_status')
    .eq('id', serviceId)
    .maybeSingle();

  if (!service || service.owner_user_id !== userData.user.id) {
    return { ok: false, message: 'Du har ikke tilgang til denne tjenesten.' };
  }

  if (service.subscription_status === 'active') {
    return { ok: false, message: 'Abonnementet er allerede aktivt.' };
  }

  let customerId = service.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.user.email ?? undefined,
      metadata: {
        service_id: serviceId,
      },
    });
    customerId = customer.id;
    await supabase.from('services').update({ stripe_customer_id: customerId }).eq('id', serviceId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: stripeConfig.priceId, quantity: 1 }],
    success_url: `${stripeConfig.appUrl}/dashboard?success=1`,
    cancel_url: `${stripeConfig.appUrl}/dashboard?canceled=1`,
    metadata: {
      service_id: serviceId,
    },
  });

  if (!session.url) {
    return { ok: false, message: 'Kunne ikke opprette Stripe Checkout.' };
  }

  return { ok: true, message: 'Redirect', url: session.url };
}

export async function getLeadsForOwnedService(
  accessToken: string,
  serviceId: string
): Promise<LeadRow[]> {
  const supabase = getSupabase();
  if (!supabase || !accessToken || !serviceId) return [];

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return [];

  const { data } = await supabase
    .from('leads')
    .select('id, service_id, name, email, message, created_at')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

