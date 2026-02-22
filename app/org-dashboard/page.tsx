'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { createOrgCheckoutSession, getOrgDashboard, type OrgDashboard } from '../../lib/organizations';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { container } from '../../lib/ui';

export default function OrgDashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [data, setData] = useState<OrgDashboard | null>(null);
  const [message, setMessage] = useState<string>('');
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'loading'>('idle');

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
    if (!session?.access_token) return;
    const loadDashboard = async () => {
      setStatus('loading');
      const result = await getOrgDashboard(session.access_token);
      if (!result.ok || !result.data) {
        setMessage(result.message);
        setStatus('error');
        return;
      }
      setData(result.data);
      setStatus('idle');
    };
    loadDashboard();
  }, [session?.access_token]);

  if (!isSupabaseConfigured) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Bedriftsoversikt</h1>
          <p className="mt-3 text-sm text-slate-600">
            Supabase er ikke konfigurert. Legg inn miljøvariabler for å bruke bedrift.
          </p>
          <ButtonLink href="/" className="mt-6">
            Til forsiden
          </ButtonLink>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Bedriftsoversikt</h1>
          <p className="mt-3 text-sm text-slate-600">Du må være innlogget for å se dette.</p>
          <ButtonLink href="/" className="mt-6">
            Til forsiden
          </ButtonLink>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${container} py-12`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Bedrift</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Bedriftsoversikt</h1>
        </div>
        <Link href="/min-side" className="text-sm font-medium text-slate-600 hover:text-slate-800">
          Til Min side
        </Link>
      </div>

      {status === 'loading' && (
        <div className="mt-6 text-sm text-slate-500">Laster bedrift ...</div>
      )}

      {status === 'error' && (
        <Card className="mt-6 border-rose-200 bg-rose-50 text-sm text-rose-700">
          {message || 'Du har ikke tilgang til bedriftens oversikt.'}
        </Card>
      )}

      {status === 'idle' && data && (
        <>
          <Card className="mt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{data.organization.name}</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Bedriftsstatus</h2>
              </div>
              <div className="text-xs text-slate-500">
                Opprettet {new Date(data.organization.created_at).toLocaleDateString('no-NO')}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Card className="bg-slate-50">
                <div className="text-xs uppercase tracking-wide text-slate-500">Medlemmer</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{data.membersCount}</div>
              </Card>
              <Card className="bg-slate-50">
                <div className="text-xs uppercase tracking-wide text-slate-500">Leads sendt</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{data.leadsCount}</div>
              </Card>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-600">Join-kode:</span>
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
                {data.organization.join_code}
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  if (navigator.clipboard) {
                    await navigator.clipboard.writeText(data.organization.join_code);
                  } else {
                    window.prompt('Kopier join-kode', data.organization.join_code);
                  }
                }}
              >
                Kopier kode
              </Button>
            </div>
          </Card>

          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Abonnement
            </h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-600">Status:</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    data.organization.subscription_status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : data.organization.subscription_status === 'past_due'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {data.organization.subscription_status === 'active'
                    ? 'Aktivt'
                    : data.organization.subscription_status === 'past_due'
                    ? 'Forfalt'
                    : 'Inaktivt'}
                </span>
              </div>
              {data.organization.subscription_status === 'active' ? (
                <p className="text-sm text-slate-600">
                  Dekker {data.membersCount} ansatte.
                </p>
              ) : (
                <Button
                  type="button"
                  disabled={checkoutStatus === 'loading'}
                  onClick={async () => {
                    if (!session?.access_token) return;
                    setCheckoutStatus('loading');
                    const result = await createOrgCheckoutSession(
                      session.access_token,
                      data.organization.id
                    );
                    setCheckoutStatus('idle');
                    if (result.ok && result.url) {
                      window.location.href = result.url;
                    } else {
                      setMessage(result.message);
                      setStatus('error');
                    }
                  }}
                >
                  Aktiver bedriftsabonnement
                </Button>
              )}
            </div>
          </Card>

          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Siste leads
            </h2>
            <div className="mt-4 space-y-3">
              {data.recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {lead.service_name ?? lead.service_id}
                    </div>
                    <div className="text-xs text-slate-500">Lead: {lead.id}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(lead.created_at).toLocaleDateString('no-NO')}
                  </div>
                </div>
              ))}
              {data.recentLeads.length === 0 && (
                <div className="text-sm text-slate-600">Ingen leads registrert ennå.</div>
              )}
            </div>
          </Card>
        </>
      )}
    </main>
  );
}

