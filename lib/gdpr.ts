'use server';

import { createClient } from '@supabase/supabase-js';

type UserProfile = {
  id: string;
  email: string | null;
};

type LeadRow = {
  id: string;
  service_id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

type LeadMessageRow = {
  id: string;
  lead_id: string;
  sender_role: string;
  message: string;
  created_at: string;
};

type ReviewRow = {
  id: string;
  service_id: string;
  rating: number;
  comment: string;
  created_at: string;
};

type ConsentRow = {
  consent_type: string;
  accepted_at: string;
};

type NotificationPreferencesRow = {
  email_lead_created: boolean;
  email_provider_replied: boolean;
  email_booking_confirmed: boolean;
  email_booking_cancelled: boolean;
  updated_at?: string | null;
};

export type MyData = {
  profile: UserProfile;
  leads: LeadRow[];
  lead_messages: LeadMessageRow[];
  reviews: ReviewRow[];
  consents: ConsentRow[];
  notification_preferences: NotificationPreferencesRow | null;
};

export type ActionResult<T> = {
  ok: boolean;
  message: string;
  data?: T;
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
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

const getUserFromToken = async (accessToken: string) => {
  const supabase = getSupabase();
  if (!supabase || !accessToken) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
};

export async function getMyData(accessToken: string): Promise<ActionResult<MyData>> {
  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const user = await getUserFromToken(accessToken);
  if (!user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: leads } = await adminClient
    .from('leads')
    .select('id, service_id, name, email, message, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const leadIds = (leads ?? []).map((lead) => lead.id as string);

  const { data: leadMessages } = leadIds.length
    ? await adminClient
        .from('lead_messages')
        .select('id, lead_id, sender_role, message, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: true })
    : { data: [] as LeadMessageRow[] };

  const { data: reviews } = await adminClient
    .from('reviews')
    .select('id, service_id, rating, comment, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: consents } = await adminClient
    .from('user_consents')
    .select('consent_type, accepted_at')
    .eq('user_id', user.id)
    .order('accepted_at', { ascending: false });

  const { data: preferences } = await adminClient
    .from('notification_preferences')
    .select(
      'email_lead_created, email_provider_replied, email_booking_confirmed, email_booking_cancelled, updated_at'
    )
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    ok: true,
    message: 'OK',
    data: {
      profile: {
        id: user.id,
        email: user.email,
      },
      leads: (leads ?? []) as LeadRow[],
      lead_messages: (leadMessages ?? []) as LeadMessageRow[],
      reviews: (reviews ?? []) as ReviewRow[],
      consents: (consents ?? []) as ConsentRow[],
      notification_preferences: (preferences as NotificationPreferencesRow | null) ?? null,
    },
  };
}

export async function exportMyData(accessToken: string): Promise<ActionResult<string>> {
  const result = await getMyData(accessToken);
  if (!result.ok || !result.data) {
    return { ok: false, message: result.message };
  }

  return {
    ok: true,
    message: 'OK',
    data: JSON.stringify(result.data, null, 2),
  };
}

export async function requestAccountDeletion(
  accessToken: string
): Promise<ActionResult<{ signedOut: boolean }>> {
  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const user = await getUserFromToken(accessToken);
  if (!user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: ownedServices } = await adminClient
    .from('services')
    .select('id')
    .eq('owner_user_id', user.id)
    .limit(1);

  if ((ownedServices ?? []).length > 0) {
    return {
      ok: false,
      message:
        'Du eier tjenester. Overfør eierskap eller deaktiver/slett tjenestene først.',
    };
  }

  const { data: existingRequest } = await adminClient
    .from('deletion_requests')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('status', 'requested')
    .maybeSingle();

  let requestId = existingRequest?.id as string | undefined;
  if (!requestId) {
    const { data: newRequest } = await adminClient
      .from('deletion_requests')
      .insert({ user_id: user.id })
      .select('id')
      .single();
    requestId = newRequest?.id as string | undefined;
  }

  const { data: leadIds } = await adminClient
    .from('leads')
    .select('id')
    .eq('user_id', user.id);

  const leadIdList = (leadIds ?? []).map((lead) => lead.id as string);

  await adminClient.from('reviews').delete().eq('user_id', user.id);

  if (leadIdList.length > 0) {
    await adminClient
      .from('lead_messages')
      .update({ message: 'Slettet av bruker' })
      .in('lead_id', leadIdList)
      .eq('sender_role', 'user');
  }

  await adminClient
    .from('leads')
    .update({
      name: 'Anonymisert',
      email: 'anonymisert@settdegetmal.no',
      message: 'Slettet av bruker',
    })
    .eq('user_id', user.id);

  await adminClient.from('notification_preferences').delete().eq('user_id', user.id);
  await adminClient.from('user_consents').delete().eq('user_id', user.id);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return { ok: false, message: 'Kunne ikke slette kontoen fullstendig.' };
  }

  if (requestId) {
    await adminClient
      .from('deletion_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', requestId);
  }

  return {
    ok: true,
    message: 'Konto slettet.',
    data: { signedOut: true },
  };
}
