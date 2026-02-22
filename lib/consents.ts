'use server';

import { createClient } from '@supabase/supabase-js';

export type ConsentType = 'terms' | 'privacy' | 'email';

const requiredConsents: ConsentType[] = ['terms', 'privacy'];

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

const getServiceSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const getUserId = async (accessToken: string) => {
  const supabase = getSupabase(accessToken);
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
};

export async function getMissingConsents(accessToken: string): Promise<ConsentType[]> {
  if (!accessToken) return requiredConsents;
  const supabase = getSupabase(accessToken);
  if (!supabase) return requiredConsents;

  const userId = await getUserId(accessToken);
  if (!userId) return requiredConsents;

  const { data } = await supabase
    .from('user_consents')
    .select('consent_type')
    .eq('user_id', userId)
    .in('consent_type', requiredConsents);

  const accepted = new Set((data ?? []).map((row) => row.consent_type as ConsentType));
  return requiredConsents.filter((type) => !accepted.has(type));
}

export async function acceptConsents(accessToken: string): Promise<{ ok: boolean; message: string }> {
  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const supabase = getSupabase(accessToken);
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const userId = await getUserId(accessToken);
  if (!userId) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const now = new Date().toISOString();
  const rows = ['terms', 'privacy', 'email'].map((type) => ({
    user_id: userId,
    consent_type: type,
    accepted_at: now,
  }));

  const { error } = await supabase.from('user_consents').upsert(rows, {
    ignoreDuplicates: true,
  });
  if (error) {
    return { ok: false, message: 'Kunne ikke lagre samtykke.' };
  }

  return { ok: true, message: 'Samtykke lagret.' };
}

export async function hasRequiredConsents(accessToken: string): Promise<boolean> {
  const missing = await getMissingConsents(accessToken);
  return missing.length === 0;
}

export type ConsentMetrics = {
  totalUsers: number;
  usersWithConsent: number;
  consentRate: number;
};

export async function getConsentMetrics(): Promise<ConsentMetrics | null> {
  const adminClient = getServiceSupabase();
  if (!adminClient) return null;

  const { count: totalUsers } = await adminClient
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  const { data: consents } = await adminClient
    .from('user_consents')
    .select('user_id, consent_type')
    .in('consent_type', requiredConsents);

  const consentMap = new Map<string, Set<ConsentType>>();
  (consents ?? []).forEach((row) => {
    const userId = row.user_id as string;
    if (!consentMap.has(userId)) {
      consentMap.set(userId, new Set<ConsentType>());
    }
    consentMap.get(userId)?.add(row.consent_type as ConsentType);
  });

  const usersWithConsent = Array.from(consentMap.values()).filter((set) =>
    requiredConsents.every((type) => set.has(type))
  ).length;

  const total = totalUsers ?? 0;
  const consentRate = total > 0 ? Math.round((usersWithConsent / total) * 100) : 0;

  return { totalUsers: total, usersWithConsent, consentRate };
}
