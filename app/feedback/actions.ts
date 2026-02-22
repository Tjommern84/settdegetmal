'use server';

import { createClient } from '@supabase/supabase-js';

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

const getAdminEmail = () => process.env.ADMIN_EMAIL?.toLowerCase() ?? '';

const getRoleForUser = async (supabase: any, userId: string, email?: string) => {
  const adminEmail = getAdminEmail();
  if (email && adminEmail && email.toLowerCase() === adminEmail) {
    return 'admin' as const;
  }

  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId);

  if ((count ?? 0) > 0) {
    return 'provider' as const;
  }

  return 'user' as const;
};

export async function submitFeedback(
  _prevState: { ok: boolean; message: string },
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const accessToken = String(formData.get('accessToken') ?? '');
  const page = String(formData.get('page') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (!message) {
    return { ok: false, message: 'Skriv inn en melding.' };
  }

  const supabase = getSupabase(accessToken || undefined);
  if (!supabase) {
    return { ok: false, message: 'Feedback er midlertidig utilgjengelig.' };
  }

  let userId: string | null = null;
  let role: 'user' | 'provider' | 'admin' = 'user';

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data.user) {
      userId = data.user.id;
      role = await getRoleForUser(supabase, data.user.id, data.user.email ?? undefined);
    }
  }

  const { error: insertError } = await supabase.from('feedback').insert({
    user_id: userId,
    role,
    page: page || null,
    message,
  });

  if (insertError) {
    return { ok: false, message: 'Kunne ikke lagre feedback nå.' };
  }

  return { ok: true, message: 'Takk for hjelpen!' };
}
