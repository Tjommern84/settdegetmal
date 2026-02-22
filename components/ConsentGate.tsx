'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { acceptConsents, getMissingConsents, type ConsentType } from '../lib/consents';

export default function ConsentGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [missingConsents, setMissingConsents] = useState<ConsentType[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('idle');

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

  useEffect(() => {
    if (!session?.access_token) {
      setMissingConsents([]);
      return;
    }
    let isMounted = true;
    setStatus('loading');
    getMissingConsents(session.access_token)
      .then((missing) => {
        if (!isMounted) return;
        setMissingConsents(missing);
        setStatus('idle');
      })
      .catch(() => {
        if (!isMounted) return;
        setMissingConsents([]);
        setStatus('idle');
      });
    return () => {
      isMounted = false;
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (missingConsents.length === 0) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [missingConsents.length]);

  if (!isSupabaseConfigured || !session || missingConsents.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-10">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold text-slate-900">Samtykke kreves</h2>
        <p className="mt-3 text-sm text-slate-600">
          For å bruke tjenesten må du godta vilkår og personvern. Dette gjelder
          håndtering av konto, forespørsler og meldinger.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
          <Link href="/vilkar" className="text-slate-700 underline">
            Les vilkår
          </Link>
          <Link href="/personvern" className="text-slate-700 underline">
            Les personvern
          </Link>
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!session.access_token || status === 'saving') return;
            setStatus('saving');
            const result = await acceptConsents(session.access_token);
            if (result.ok) {
              setMissingConsents([]);
            }
            setStatus('idle');
          }}
          className="mt-6 w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={status === 'saving'}
          aria-label="Jeg godtar vilkår og personvern"
        >
          {status === 'saving' ? 'Lagrer ...' : 'Jeg godtar'}
        </button>
      </div>
    </div>
  );
}
