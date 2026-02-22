import { createClient } from '@supabase/supabase-js';
import { ENABLE_ADMIN } from './featureFlags';

const getSupabase = (accessToken?: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
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

export async function isAdminByEmail(accessToken: string): Promise<boolean> {
  if (!ENABLE_ADMIN) return false;
  const supabase = getSupabase(accessToken);
  if (!supabase || !accessToken) return false;
  const adminEmail = getAdminEmail();
  if (!adminEmail) return false;
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) return false;
  return data.user.email.toLowerCase() === adminEmail;
}
