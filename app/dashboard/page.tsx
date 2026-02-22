'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { services } from '../../lib/providers';
import { createCheckoutSession, getLeadsForOwnedService, getOwnedServices } from './actions';
import { ENABLE_PAYMENTS, ENABLE_PILOT_MODE } from '../../lib/featureFlags';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { container } from '../../lib/ui';
import {
  bookingStatusLabel,
  cancellationTypeLabel,
  formatBookingTime,
  type BookingItem,
} from '../../lib/booking';
import { getMyBookings } from '../actions/bookings';

type OwnedService = {
  id: string;
  name: string;
};

type ServiceSummary = {
  id: string;
  name: string;
  leadCount: number;
  subscription_status: 'inactive' | 'active' | 'past_due';
};

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ownedServices, setOwnedServices] = useState<ServiceSummary[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [providerBookings, setProviderBookings] = useState<BookingItem[]>([]);
  const [bookingsStatus, setBookingsStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const fallbackMap = useMemo(() => {
    return new Map(services.map((service) => [service.id, service.name]));
  }, []);

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
    const loadServices = async () => {
      setStatus('loading');
      const servicesList = await getOwnedServices(session.access_token);
      const summaries = await Promise.all(
        servicesList.map(async (service) => {
          const leads = await getLeadsForOwnedService(session.access_token, service.id);
          return {
            id: service.id,
            name: service.name || fallbackMap.get(service.id) || 'Ukjent tjeneste',
            leadCount: leads.length,
            subscription_status: service.subscription_status ?? 'inactive',
          };
        })
      );
      setOwnedServices(summaries);
      setStatus('idle');
    };
    loadServices();
  }, [session, fallbackMap]);

  useEffect(() => {
    if (!session?.access_token) return;
    let isMounted = true;
    const loadBookings = async () => {
      setBookingsStatus('loading');
      try {
        const result = await getMyBookings(session.access_token);
        if (!isMounted) return;
        setProviderBookings(result.providerBookings);
        setBookingsStatus('idle');
      } catch {
        if (!isMounted) return;
        setBookingsStatus('error');
      }
    };
    loadBookings();
    return () => {
      isMounted = false;
    };
  }, [session?.access_token]);

  if (!isSupabaseConfigured) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-3 text-sm text-slate-600">
            Supabase er ikke konfigurert. Legg inn miljøvariabler for å bruke
            dashboard.
          </p>
          <ButtonLink href="/" className="mt-6">
            Gå til forsiden
          </ButtonLink>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-3 text-sm text-slate-600">
            Logg inn for å se dine tjenester.
          </p>
          <ButtonLink href="/" className="mt-6">
            Gå til forsiden
          </ButtonLink>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${container} py-12`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Dine tjenester
          </h1>
        </div>
        <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-800">
          Til forsiden
        </Link>
      </div>

      {ENABLE_PILOT_MODE && (
        <Card className="mt-6 border-amber-200 bg-amber-50 text-sm text-amber-700">
          Pilot – funksjoner kan endres.
        </Card>
      )}

      {!ENABLE_PAYMENTS && (
        <Card className="mt-6 border-amber-200 bg-amber-50 text-sm text-amber-700">
          Betaling er ikke aktivert ennå. Leads og abonnement er midlertidig avskrudd i MVP.
        </Card>
      )}

      {status === 'loading' && (
        <div className="mt-6 text-sm text-slate-500">Laster tjenester ...</div>
      )}

      <div className="mt-6 grid gap-4">
        {ownedServices.map((service) => (
          <Card key={service.id} className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{service.name}</h2>
                <p className="text-sm text-slate-600">
                  {service.leadCount} forespørsler
                </p>
                {service.leadCount === 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Når første forespørsel kommer inn, dukker den opp her.
                  </p>
                )}
                {service.subscription_status !== 'active' && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {ENABLE_PAYMENTS
                      ? 'Aktiver abonnement for å motta leads.'
                      : 'Abonnement er midlertidig deaktivert før lansering.'}
                  </div>
                )}
                {service.subscription_status === 'active' && (
                  <Chip variant="accent" className="mt-3">
                    Abonnement aktivt
                  </Chip>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/dashboard/${service.id}`}
                  className="text-sm font-semibold text-slate-900"
                >
                  Se leads
                </Link>
                <Link
                  href={`/dashboard/services/${service.id}/edit`}
                  className="text-sm font-semibold text-slate-900"
                >
                  Rediger profil
                </Link>
                {service.subscription_status !== 'active' && ENABLE_PAYMENTS && (
                  <SubscribeButton
                    serviceId={service.id}
                    accessToken={session.access_token}
                  />
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Kommende bookinger</h2>
            <p className="mt-1 text-sm text-slate-600">
              Oversikt over bekreftede avtaler for dine tjenester.
            </p>
          </div>
          {bookingsStatus === 'loading' && (
            <p className="text-xs text-slate-500">Laster bookinger ...</p>
          )}
        </div>
        {bookingsStatus === 'error' && (
          <div className="mt-4 text-sm text-rose-600">Klarte ikke hente bookinger.</div>
        )}
        {bookingsStatus !== 'loading' && providerBookings.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">Ingen bookinger for øyeblikket.</p>
        )}
        {bookingsStatus !== 'loading' && providerBookings.length > 0 && (
          <div className="mt-4 space-y-3">
            {providerBookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link
                      href={`/dashboard/leads/${booking.lead_id}`}
                      className="text-base font-semibold text-slate-900"
                    >
                      {booking.service_name ?? booking.service_id}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {formatBookingTime(booking.scheduled_at)}
                    </p>
                  </div>
                  <Chip className="text-xs text-slate-700">
                    {bookingStatusLabel[booking.status]}
                  </Chip>
                </div>
                {booking.cancellation_type && (
                  <p className="mt-1 text-xs font-semibold text-rose-600">
                    {cancellationTypeLabel[booking.cancellation_type]}
                  </p>
                )}
                {booking.no_show_marked && (
                  <p className="mt-1 text-xs text-slate-500">
                    No-show markert{' '}
                    {booking.no_show_marked_at
                      ? formatBookingTime(booking.no_show_marked_at)
                      : formatBookingTime(booking.scheduled_at)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {status === 'idle' && ownedServices.length === 0 && (
        <Card className="mt-6 text-sm text-slate-600">
          Du eier ingen tjenester ennå. Finn en tjeneste og trykk "Claim" for å komme i gang.
        </Card>
      )}
    </main>
  );
}

function SubscribeButton({
  serviceId,
  accessToken,
}: {
  serviceId: string;
  accessToken: string;
}) {
  const [state, action] = useFormState(createCheckoutSession, {
    ok: false,
    message: '',
    url: undefined,
  });
  const { pending } = useFormStatus();

  useEffect(() => {
    if (state.ok && state.url) {
      window.location.href = state.url;
    }
  }, [state.ok, state.url]);

  return (
    <form action={action}>
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="accessToken" value={accessToken} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Åpner ...' : 'Aktiver abonnement'}
      </Button>
    </form>
  );
}
