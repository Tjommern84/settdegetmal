import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Using `any` for database types until proper types are generated.
// Generate types with: npx supabase gen types typescript --project-id <id>
let cachedClient: SupabaseClient<any> | null = null;

export function getServiceSupabase(): SupabaseClient<any> | null {
  if (cachedClient) return cachedClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
  });
  return cachedClient;
}
