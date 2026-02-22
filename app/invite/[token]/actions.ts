'use server';

import { createClient } from '@supabase/supabase-js';

type InviteInfo = {
  id: string;
  email: string;
  service_id: string | null;
  created_at: string;
  accepted_at: string | null;
};

const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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

export async function getInviteByToken(
  token: string
): Promise<{ ok: boolean; invite?: InviteInfo }> {
  const adminClient = getAdminClient();
  if (!adminClient || !token) return { ok: false };

  const { data } = await adminClient
    .from('provider_invites')
    .select('id, email, service_id, created_at, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (!data || data.accepted_at) {
    return { ok: false };
  }

  return { ok: true, invite: data as InviteInfo };
}

export async function acceptInvite(
  token: string,
  accessToken: string
): Promise<{ ok: boolean; message: string; redirect?: string }> {
  if (!token || !accessToken) {
    return { ok: false, message: 'Ugyldig invitasjon.' };
  }

  const adminClient = getAdminClient();
  const supabase = getSupabase(accessToken);
  if (!adminClient || !supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const { data: invite } = await adminClient
    .from('provider_invites')
    .select('id, service_id, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (!invite || invite.accepted_at) {
    return { ok: false, message: 'Invitasjonen er ikke gyldig lenger.' };
  }

  const { data: updated } = await adminClient
    .from('provider_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('accepted_at', null)
    .select('id')
    .maybeSingle();

  if (!updated) {
    return { ok: false, message: 'Invitasjonen kunne ikke godtas.' };
  }

  if (invite.service_id) {
    await supabase
      .from('services')
      .update({ owner_user_id: userData.user.id })
      .eq('id', invite.service_id)
      .is('owner_user_id', null);

    return {
      ok: true,
      message: 'Invitasjon godtatt.',
      redirect: `/dashboard/services/${invite.service_id}/edit`,
    };
  }

  return { ok: true, message: 'Invitasjon godtatt.', redirect: '/dashboard' };
}
