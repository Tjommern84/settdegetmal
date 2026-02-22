'use server';

import { createClient } from '@supabase/supabase-js';

type ErrorLevel = 'info' | 'warn' | 'error';

type ErrorSource = 'server_action' | 'route' | 'client' | string;

type LogErrorParams = {
  level?: ErrorLevel;
  source?: ErrorSource;
  context?: string;
  message: string;
  stack?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
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

export async function logError(params: LogErrorParams): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    if (!supabase) return;

    const payload = {
      level: params.level ?? 'error',
      source: params.source ?? 'server_action',
      context: params.context ?? null,
      message: params.message,
      stack: params.stack ?? null,
      user_id: params.userId ?? null,
      metadata: params.metadata ?? null,
    };

    await supabase.from('app_errors').insert(payload);
  } catch {
    return;
  }
}
