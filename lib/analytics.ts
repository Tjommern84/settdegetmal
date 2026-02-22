import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { ENABLE_PILOT_MODE } from './featureFlags';

export type EventType =
  | 'search_performed'
  | 'result_clicked'
  | 'profile_viewed'
  | 'lead_created'
  | 'partner_api_call'
  | 'cache_hit'
  | 'cache_miss';

export type TrackEventInput = {
  type: EventType;
  serviceId?: string | null;
  metadata?: Record<string, unknown>;
  accessToken?: string;
};

const getSupabase = (accessToken?: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
};

export async function trackEvent(input: TrackEventInput): Promise<void> {
  const client = getSupabase(input.accessToken);
  if (!client) return;

  let userId: string | null = null;
  if (input.accessToken) {
    const { data } = await client.auth.getUser(input.accessToken);
    userId = data.user?.id ?? null;
  } else if (typeof window !== 'undefined' && supabase) {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id ?? null;
  }

  const metadata =
    ENABLE_PILOT_MODE && typeof window === 'undefined'
      ? { ...input.metadata, pilot_mode: true, server_context: true }
      : input.metadata ?? null;

  await client.from('events').insert({
    type: input.type,
    user_id: userId,
    service_id: input.serviceId ?? null,
    metadata,
  });
}
