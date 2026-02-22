import { createClient } from '@supabase/supabase-js';
import { trackEvent } from '../../../../lib/analytics';
import { ENABLE_PARTNER_API } from '../../../../lib/featureFlags';

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type RateEntry = { count: number; resetAt: number };

const rateStore = (() => {
  const globalScope = globalThis as typeof globalThis & {
    __partnerRateLimit?: Map<string, RateEntry>;
  };
  if (!globalScope.__partnerRateLimit) {
    globalScope.__partnerRateLimit = new Map();
  }
  return globalScope.__partnerRateLimit;
})();

type CoverageRule =
  | { type: 'radius'; center: { lat: number; lon: number }; radius_km: number }
  | { type: 'cities'; cities: string[] }
  | { type: 'region'; region: 'norway' | 'nordic' };

const formatCoverage = (coverage: unknown): string[] => {
  if (!Array.isArray(coverage)) return [];

  const parts: string[] = [];
  for (const rule of coverage as CoverageRule[]) {
    if (!rule || typeof rule !== 'object' || !('type' in rule)) continue;
    if (rule.type === 'region') {
      parts.push(rule.region === 'nordic' ? 'Hele Norden' : 'Hele Norge');
    } else if (rule.type === 'cities') {
      if (Array.isArray(rule.cities) && rule.cities.length > 0) {
        parts.push(rule.cities.join(', '));
      }
    } else if (rule.type === 'radius') {
      const center = rule.center;
      if (center && typeof center.lat === 'number' && typeof center.lon === 'number') {
        parts.push(`Innenfor ${rule.radius_km} km fra (${center.lat}, ${center.lon})`);
      }
    }
  }

  return parts;
};

const logPartnerCall = async (endpoint: string, status: number, authorized: boolean) => {
  try {
    await trackEvent({
      type: 'partner_api_call',
      metadata: { endpoint, status, authorized },
    });
  } catch {
    // Ignore logging errors for partner calls.
  }
};

const checkRateLimit = (key: string) => {
  const now = Date.now();
  const entry = rateStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  rateStore.set(key, entry);
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetAt: entry.resetAt };
};

export async function GET(request: Request) {
  if (!ENABLE_PARTNER_API) {
    return new Response('Not found', { status: 404 });
  }

  const partnerKeyEnv = process.env.PARTNER_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!partnerKeyEnv || !supabaseUrl || !supabaseAnonKey) {
    return new Response('Server misconfiguration', { status: 500 });
  }

  const partnerKey = request.headers.get('x-partner-key')?.trim() ?? '';
  const endpoint = '/api/partner/services';

  if (!partnerKey || partnerKey !== partnerKeyEnv) {
    await logPartnerCall(endpoint, 401, false);
    return new Response('Unauthorized', { status: 401 });
  }

  const limit = checkRateLimit(partnerKey);
  if (!limit.allowed) {
    await logPartnerCall(endpoint, 429, true);
    return new Response('Rate limit exceeded', { status: 429 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: services, error } = await supabase
    .from('services')
    .select('id, name, type, coverage, goals, rating_avg, is_active')
    .eq('is_active', true);

  if (error) {
    await logPartnerCall(endpoint, 500, true);
    return new Response('Failed to load services', { status: 500 });
  }

  const payload = (services ?? []).map((service) => ({
    id: service.id as string,
    name: service.name as string,
    type: service.type as string,
    coverage: formatCoverage(service.coverage),
    goals: (service.goals as string[]) ?? [],
    rating_avg: Number(service.rating_avg ?? 0),
  }));

  await logPartnerCall(endpoint, 200, true);

  return Response.json({ services: payload });
}
