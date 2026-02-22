'use server';

import { createClient } from '@supabase/supabase-js';

export type NotificationPreferences = {
  email_lead_created: boolean;
  email_provider_replied: boolean;
  email_booking_confirmed: boolean;
  email_booking_cancelled: boolean;
};

export type EmailEventType =
  | 'lead_created'
  | 'provider_replied'
  | 'booking_confirmed'
  | 'booking_cancelled';

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

const ensurePreferenceRow = async (
  supabase: any,
  userId: string
) => {
  const { data } = await supabase
    .from('notification_preferences')
    .select(
      'email_lead_created, email_provider_replied, email_booking_confirmed, email_booking_cancelled'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (data) {
    return data as NotificationPreferences;
  }

  const { data: inserted } = await supabase
    .from('notification_preferences')
    .insert({ user_id: userId } as any)
    .select(
      'email_lead_created, email_provider_replied, email_booking_confirmed, email_booking_cancelled'
    )
    .single();

  return (
    inserted ?? {
      email_lead_created: true,
      email_provider_replied: true,
      email_booking_confirmed: true,
      email_booking_cancelled: true,
    }
  );
};

export async function getNotificationPreferences(
  accessToken: string
): Promise<NotificationPreferences | null> {
  const supabase = getSupabase();
  if (!supabase || !accessToken) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return null;

  return ensurePreferenceRow(supabase, userData.user.id);
}

export async function updateNotificationPreferences(
  accessToken: string,
  updates: Partial<NotificationPreferences>
): Promise<{ ok: boolean; message: string; preferences?: NotificationPreferences }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const updatePayload: Partial<NotificationPreferences> = {};
  if (typeof updates.email_lead_created === 'boolean') {
    updatePayload.email_lead_created = updates.email_lead_created;
  }
  if (typeof updates.email_provider_replied === 'boolean') {
    updatePayload.email_provider_replied = updates.email_provider_replied;
  }
  if (typeof updates.email_booking_confirmed === 'boolean') {
    updatePayload.email_booking_confirmed = updates.email_booking_confirmed;
  }
  if (typeof updates.email_booking_cancelled === 'boolean') {
    updatePayload.email_booking_cancelled = updates.email_booking_cancelled;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { ok: false, message: 'Ingen endringer å lagre.' };
  }

  await ensurePreferenceRow(supabase, userData.user.id);

  const { data: updated, error: updateError } = await supabase
    .from('notification_preferences')
    .update({ ...updatePayload, updated_at: new Date().toISOString() })
    .eq('user_id', userData.user.id)
    .select(
      'email_lead_created, email_provider_replied, email_booking_confirmed, email_booking_cancelled'
    )
    .maybeSingle();

  if (updateError) {
    return { ok: false, message: 'Kunne ikke lagre preferansene.' };
  }

  return {
    ok: true,
    message: 'Lagret.',
    preferences:
      updated ?? {
        email_lead_created: true,
        email_provider_replied: true,
        email_booking_confirmed: true,
        email_booking_cancelled: true,
      },
  };
}

export async function shouldSendEmail(
  userId: string,
  eventType: EmailEventType
): Promise<boolean> {
  if (!userId) return false;

  const supabase = getServiceSupabase();
  if (!supabase) return true;

  const { data } = await supabase
    .from('notification_preferences')
    .select(
      'email_lead_created, email_provider_replied, email_booking_confirmed, email_booking_cancelled'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    await supabase.from('notification_preferences').insert({ user_id: userId });
    return true;
  }

  if (eventType === 'lead_created') {
    return data.email_lead_created ?? true;
  }
  if (eventType === 'provider_replied') {
    return data.email_provider_replied ?? true;
  }
  if (eventType === 'booking_confirmed') {
    return data.email_booking_confirmed ?? true;
  }
  return data.email_booking_cancelled ?? true;
}
