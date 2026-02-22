'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import AuthButton from '../../../components/AuthButton';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { container } from '../../../lib/ui';
import { acceptInvite, getInviteByToken } from './actions';

type InviteInfo = {
  id: string;
  email: string;
  service_id: string | null;
  created_at: string;
  accepted_at: string | null;
};

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [actionState, setActionState] = useState<{ ok: boolean; message: string }>({
    ok: false,
    message: '',
  });

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
    let isMounted = true;
    setStatus('loading');
    getInviteByToken(params.token)
      .then((result) => {
        if (!isMounted) return;
        if (!result.ok || !result.invite) {
          setInvite(null);
          setStatus('error');
          return;
        }
        setInvite(result.invite);
        setStatus('ready');
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus('error');
      });
    return () => {
      isMounted = false;
    };
  }, [params.token]);

  if (!isSupabaseConfigured) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Invitasjon</h1>
          <p className="mt-3 text-sm text-slate-600">
            Supabase er ikke konfigurert. Legg inn miljøvariabler for å bruke invitasjoner.
          </p>
          <ButtonLink href="/" className="mt-6">
            Tilbake til forsiden
          </ButtonLink>
        </Card>
      </main>
    );
  }

  if (status === 'loading') {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <p className="text-sm text-slate-600">Laster invitasjon ...</p>
        </Card>
      </main>
    );
  }

  if (status === 'error' || !invite) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Invitasjon</h1>
          <p className="mt-3 text-sm text-slate-600">
            Denne invitasjonen er ikke gyldig lenger.
          </p>
          <ButtonLink href="/" className="mt-6">
            Tilbake til forsiden
          </ButtonLink>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Logg inn for å fortsette</h1>
          <p className="mt-3 text-sm text-slate-600">
            Invitasjon funnet for {invite.email}. Logg inn for å godta.
          </p>
          <div className="mt-6">
            <AuthButton />
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${container} py-16`}>
      <Card>
        <h1 className="text-2xl font-semibold text-slate-900">Invitasjon funnet</h1>
        <p className="mt-3 text-sm text-slate-600">
          Invitasjon funnet for {invite.email}. Godta for å komme i gang.
        </p>
        {actionState.message && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              actionState.ok
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {actionState.message}
          </div>
        )}
        <Button
          className="mt-6"
          onClick={async () => {
            if (!session?.access_token) return;
            const result = await acceptInvite(params.token, session.access_token);
            setActionState({ ok: result.ok, message: result.message });
            if (result.ok && result.redirect) {
              router.push(result.redirect);
            }
          }}
        >
          Godta invitasjon
        </Button>
      </Card>
    </main>
  );
}
