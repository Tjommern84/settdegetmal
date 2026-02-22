'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { Button, ButtonLink } from './ui/Button';
import { Input } from './ui/Input';
import { label } from '../lib/ui';

export default function AuthButton() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return <ButtonLink href="/min-side">Min side</ButtonLink>;
  }

  if (session) {
    return <ButtonLink href="/min-side">Min side</ButtonLink>;
  }

  return (
    <div className="relative flex items-center gap-2 sm:gap-4">
      <button
        type="button"
        onClick={() => {
          setShowForm((prev) => !prev);
          setStatus('idle');
          setError('');
        }}
        className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        Logg inn
      </button>
      <Button
        type="button"
        onClick={() => {
          setShowForm(true);
          setStatus('idle');
          setError('');
        }}
      >
        Bli medlem
      </Button>

      {showForm && (
        <div className="absolute right-0 top-12 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <form
            className="grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setError('');
              setStatus('idle');
              if (!email) {
                setError('Skriv inn e-postadresse.');
                setStatus('error');
                return;
              }
              if (!supabase) {
                setError('Supabase er ikke konfigurert.');
                setStatus('error');
                return;
              }
              const { error: authError } = await supabase.auth.signInWithOtp({
                email,
                options: {
                  emailRedirectTo: `${window.location.origin}/min-side`,
                },
              });
              if (authError) {
                setError('Kunne ikke sende magisk lenke.');
                setStatus('error');
                return;
              }
              setStatus('sent');
            }}
          >
            <label htmlFor="auth-email" className={label}>
              E-post
            </label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="din@epost.no"
            />
            <Button type="submit">Send magisk lenke</Button>
            {status === 'sent' && (
              <p className="text-xs text-emerald-600">
                Sjekk e-posten din for innloggingslenke.
              </p>
            )}
            {status === 'error' && (
              <p className="text-xs text-rose-600">{error}</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}


