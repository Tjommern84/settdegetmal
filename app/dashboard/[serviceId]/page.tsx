'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { services } from '../../../lib/providers';
import { getLeadsForOwnedService } from '../actions';
import { ButtonLink } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { container } from '../../../lib/ui';

type LeadRow = {
  id: string;
  service_id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export default function ServiceLeadsPage({ params }: { params: { serviceId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const serviceName = useMemo(() => {
    return services.find((service) => service.id === params.serviceId)?.name ?? 'Tjeneste';
  }, [params.serviceId]);

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
    const loadLeads = async () => {
      setStatus('loading');
      const data = await getLeadsForOwnedService(session.access_token, params.serviceId);
      setLeads(data);
      setStatus('idle');
    };
    loadLeads();
  }, [session, params.serviceId]);

  if (!isSupabaseConfigured) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="mt-3 text-sm text-slate-600">Supabase er ikke konfigurert.</p>
          <ButtonLink href="/dashboard" className="mt-6">
            Tilbake til dashboard
          </ButtonLink>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="mt-3 text-sm text-slate-600">Logg inn for å se leads.</p>
          <ButtonLink href="/dashboard" className="mt-6">
            Tilbake til dashboard
          </ButtonLink>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${container} py-12`}>
      <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-700">
        Tilbake til dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-slate-900">{serviceName}</h1>

      {status === 'loading' && (
        <div className="mt-6 text-sm text-slate-500">Laster leads ...</div>
      )}

      <div className="mt-6 grid gap-4">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/dashboard/leads/${lead.id}`}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{lead.name}</h2>
                <p className="text-sm text-slate-500">{lead.email}</p>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(lead.created_at).toLocaleDateString('no-NO')}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700">{lead.message}</p>
          </Link>
        ))}
      </div>

      {status === 'idle' && leads.length === 0 && (
        <Card className="mt-6 text-sm text-slate-600">
          Ingen leads enda. Del profilen din for å få de første forespørslene.
        </Card>
      )}
    </main>
  );
}
