import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      {
        status: 'fail',
        time: new Date().toISOString(),
        supabase: 'fail',
      },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.from('services').select('id', { head: true }).limit(1);

  if (error) {
    return Response.json(
      {
        status: 'fail',
        time: new Date().toISOString(),
        supabase: 'fail',
      },
      { status: 500 }
    );
  }

  return Response.json({
    status: 'ok',
    time: new Date().toISOString(),
    supabase: 'ok',
  });
}
