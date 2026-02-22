import { logError } from './errorLogger';

const getAccessTokenFromArgs = (args: unknown[]): string | null => {
  for (const arg of args) {
    if (arg instanceof FormData) {
      const token = arg.get('accessToken');
      if (typeof token === 'string' && token) return token;
    }
  }
  return null;
};

const getUserIdFromToken = async (accessToken?: string): Promise<string | null> => {
  if (!accessToken) return null;
  // Dynamic import to avoid 'use server' context issues
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
};

export function wrapServerAction<
  TArgs extends unknown[],
  TResult extends { ok: boolean; message: string }
>(
  actionName: string,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  const wrapped = async (...args: TArgs): Promise<TResult> => {
    try {
      return await fn(...args);
    } catch (error) {
      const accessToken = getAccessTokenFromArgs(args);
      const userId = await getUserIdFromToken(accessToken ?? undefined);
      await logError({
        level: 'error',
        source: 'server_action',
        context: actionName,
        message: error instanceof Error ? error.message : 'Ukjent feil',
        stack: error instanceof Error ? error.stack : null,
        userId,
      });

      return {
        ok: false,
        message: 'Noe gikk galt. Prøv igjen.',
      } as TResult;
    }
  };
  return wrapped;
}
