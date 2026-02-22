'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { services } from '../../lib/providers';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../../lib/notificationPreferences';
import { exportMyData, getMyData, requestAccountDeletion } from '../../lib/gdpr';
import {
  createOrganization,
  getMyOrganization,
  joinOrganization,
  type OrganizationMembership,
} from '../../lib/organizations';
import { Button, ButtonLink, type ButtonVariant } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Input } from '../../components/ui/Input';
import { container } from '../../lib/ui';
import { Recommendation } from '../actions/recommendations';
import {
  bookingStatusLabel,
  cancellationTypeLabel,
  formatBookingTime,
  type BookingItem,
} from '../../lib/booking';
import { cancelBooking, getMyBookings } from '../actions/bookings';

function SubmitButton({
  children,
  pendingText,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  pendingText: string;
  disabled?: boolean;
  variant?: ButtonVariant;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={disabled || pending}>
      {pending ? pendingText : children}
    </Button>
  );
}

type Lead = {
  id: string;
  service_id: string;
  name: string;
  email: string;
  message: string;
  status?: string | null;
  created_at: string;
};

type DataSummary = {
  leads: number;
  reviews: number;
  messages: number;
  consents: number;
  hasPreferences: boolean;
};

type DeleteState = 'idle' | 'confirm' | 'processing' | 'done' | 'error';

type DataState = 'idle' | 'loading' | 'ready' | 'error';

type ExportState = 'idle' | 'loading' | 'error' | 'done';

type OrgStatus = 'idle' | 'loading' | 'error';

type OrgActionStatus = 'idle' | 'loading';

export default function MinSidePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [prefStatus, setPrefStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [dataStatus, setDataStatus] = useState<DataState>('idle');
  const [exportStatus, setExportStatus] = useState<ExportState>('idle');
  const [deleteStatus, setDeleteStatus] = useState<DeleteState>('idle');
  const [deleteMessage, setDeleteMessage] = useState<string>('');
  const [orgStatus, setOrgStatus] = useState<OrgStatus>('idle');
  const [orgActionStatus, setOrgActionStatus] = useState<OrgActionStatus>('idle');
  const [orgMembership, setOrgMembership] = useState<OrganizationMembership | null>(null);
  const [orgMessage, setOrgMessage] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [customerBookings, setCustomerBookings] = useState<BookingItem[]>([]);
  const [bookingsStatus, setBookingsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [cancelBookingState, cancelBookingAction] = useFormState(cancelBooking, {
    ok: false,
    message: '',
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationStatus, setRecommendationStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle'
  );

  const serviceMap = useMemo(() => {
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
    if (!session?.user || !supabase) return;
    const client = supabase;
    const loadLeads = async () => {
      setStatus('loading');
      const { data, error } = await client
        .from('leads')
        .select('id, service_id, name, email, message, status, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setStatus('error');
        return;
      }
      setLeads(data ?? []);
      setStatus('idle');
    };
    loadLeads();
  }, [session]);

  useEffect(() => {
    if (!session?.access_token) return;
    let isMounted = true;
    const fetchBookings = async () => {
      setBookingsStatus('loading');
      try {
        const result = await getMyBookings(session.access_token);
        if (!isMounted) return;
        setCustomerBookings(result.customerBookings);
        setBookingsStatus('idle');
      } catch {
        if (!isMounted) return;
        setBookingsStatus('error');
      }
    };
    fetchBookings();
    return () => {
      isMounted = false;
    };
  }, [session?.access_token, cancelBookingState.ok]);

  useEffect(() => {
    if (!session?.access_token) {
      setRecommendations([]);
      setRecommendationStatus('idle');
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    const fetchRecommendations = async () => {
      setRecommendationStatus('loading');
      try {
        const response = await fetch('/api/recommendations?limit=5', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Klarte ikke hente anbefalinger.');
        }
        const data = await response.json();
        if (!isMounted) return;
        const items: Recommendation[] = Array.isArray(data.recommendations)
          ? data.recommendations
          : [];
        setRecommendations(items);
        setRecommendationStatus('idle');
      } catch {
        if (!isMounted) return;
        setRecommendations([]);
        setRecommendationStatus('error');
      }
    };
    fetchRecommendations();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [session?.access_token, cancelBookingState.ok]);

  useEffect(() => {
    if (!session?.access_token) return;
    let isMounted = true;
    setPrefStatus('loading');
    getNotificationPreferences(session.access_token)
      .then((data) => {
        if (!isMounted) return;
        setPreferences(data);
        setPrefStatus('idle');
      })
      .catch(() => {
        if (!isMounted) return;
        setPrefStatus('error');
      });
    return () => {
      isMounted = false;
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return;
    let isMounted = true;
    const loadOrg = async () => {
      setOrgStatus('loading');
      const result = await getMyOrganization(session.access_token);
      if (!isMounted) return;
      if (!result.ok) {
        setOrgMessage(result.message ?? 'Kunne ikke hente bedrift.');
        setOrgStatus('error');
        return;
      }
      setOrgMembership(result.membership ?? null);
      setOrgStatus('idle');
    };
    loadOrg();
    return () => {
      isMounted = false;
    };
  }, [session?.access_token]);

  const handlePreferenceToggle =
    (key: keyof NotificationPreferences) => (event: ChangeEvent<HTMLInputElement>) => {
      setPreferences((prev) => (prev ? { ...prev, [key]: event.target.checked } : prev));
    };

  const handlePreferenceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.access_token || !preferences) return;
    setPrefStatus('saving');
    const result = await updateNotificationPreferences(session.access_token, preferences);
    if (result.ok) {
      setPreferences(result.preferences ?? preferences);
      setPrefStatus('saved');
    } else {
      setPrefStatus('error');
    }
  };

  const handleLoadData = async () => {
    if (!session?.access_token) return;
    setDataStatus('loading');
    const result = await getMyData(session.access_token);
    if (!result.ok || !result.data) {
      setDataStatus('error');
      return;
    }
    setDataSummary({
      leads: result.data.leads.length,
      reviews: result.data.reviews.length,
      messages: result.data.lead_messages.length,
      consents: result.data.consents.length,
      hasPreferences: Boolean(result.data.notification_preferences),
    });
    setDataStatus('ready');
  };

  const handleExport = async () => {
    if (!session?.access_token) return;
    setExportStatus('loading');
    const result = await exportMyData(session.access_token);
    if (!result.ok || !result.data) {
      setExportStatus('error');
      return;
    }

    const blob = new Blob([result.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `settdegetmal-data-${new Date().toISOString().split('T')[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportStatus('done');
  };

  const handleDelete = async () => {
    if (!session?.access_token) return;
    setDeleteStatus('processing');
    setDeleteMessage('');
    const result = await requestAccountDeletion(session.access_token);
    if (!result.ok) {
      setDeleteMessage(result.message);
      setDeleteStatus('error');
      return;
    }

    setDeleteStatus('done');
    setDeleteMessage(result.message);
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const handleJoinOrg = async () => {
    if (!session?.access_token) return;
    setOrgActionStatus('loading');
    setOrgMessage('');
    const result = await joinOrganization(session.access_token, joinCode);
    if (result.ok && result.organization) {
      setOrgMembership({ organization: result.organization, role: 'member' });
      setJoinCode('');
    } else {
      setOrgMessage(result.message);
    }
    setOrgActionStatus('idle');
  };

  const handleCreateOrg = async () => {
    if (!session?.access_token) return;
    setOrgActionStatus('loading');
    setOrgMessage('');
    const result = await createOrganization(session.access_token, orgName);
    if (result.ok && result.organization) {
      setOrgMembership({ organization: result.organization, role: 'admin' });
      setOrgName('');
    } else {
      setOrgMessage(result.message);
    }
    setOrgActionStatus('idle');
  };

  if (!isSupabaseConfigured) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Min side</h1>
          <p className="mt-3 text-sm text-slate-600">
            Supabase er ikke konfigurert. Legg inn miljøvariabler for å bruke innlogging og
            forespørsler.
          </p>
          <ButtonLink href="/" className="mt-6">
            Gå til forsiden
          </ButtonLink>
        </Card>
      </main>
    );
  }

  if (deleteStatus === 'done') {
    return (
      <main className={`${container} py-16`}>
        <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-700">
          {deleteMessage || 'Konto slettet.'}{' '}
          <Link href="/" className="font-semibold underline">
            Tilbake til forsiden
          </Link>
        </Card>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Min side</h1>
          <p className="mt-3 text-sm text-slate-600">
            Du må være innlogget for å se forespørslene dine.
          </p>
          <ButtonLink href="/" className="mt-6">
            Gå til forsiden
          </ButtonLink>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${container} py-10`}>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Min side</p>
            <h1 className="text-3xl font-semibold text-slate-900">Min side</h1>
            <p className="mt-1 text-sm text-slate-600">Fortsett der du slapp</p>
          </div>
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-800">
            Til forsiden
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/flyt">Finn trening som passer deg</ButtonLink>
          <ButtonLink variant="secondary" href="/resultater">
            Se resultater
          </ButtonLink>
        </div>
      </section>

      <section className="mt-6">
        <Card className="rounded-2xl border-0 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
          <p className="text-xs uppercase tracking-wide text-slate-300">Neste steg</p>
          <div className="mt-4 space-y-2">
            {(() => {
              const nextLead = leads[0];
              const upcomingBooking =
                customerBookings.find((booking) => booking.status === 'confirmed') ??
                customerBookings[0];
              if (nextLead) {
                return (
                  <>
                    <p className="text-base font-semibold text-white">
                      {serviceMap.get(nextLead.service_id) ?? 'Ukjent tjeneste'}
                    </p>
                    <p className="text-sm text-slate-200">
                      {nextLead.status ?? 'Ny forespørsel'} ·{' '}
                      {new Date(nextLead.created_at).toLocaleDateString('no-NO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    <ButtonLink
                      href={`/dashboard/leads/${nextLead.id}`}
                      variant="secondary"
                      className="px-3 text-xs"
                    >
                      Se forespørsel
                    </ButtonLink>
                  </>
                );
              }
              if (upcomingBooking) {
                return (
                  <>
                    <p className="text-base font-semibold text-white">
                      {upcomingBooking.service_name ?? upcomingBooking.service_id}
                    </p>
                    <p className="text-sm text-slate-200">
                      {bookingStatusLabel[upcomingBooking.status]} ·{' '}
                      {formatBookingTime(upcomingBooking.scheduled_at)}
                    </p>
                    <ButtonLink href="/dashboard" variant="secondary" className="px-3 text-xs">
                      Se bookinger
                    </ButtonLink>
                  </>
                );
              }
              return (
                <>
                  <p className="text-base font-semibold text-white">Klar for nye trening</p>
                  <p className="text-sm text-slate-200">
                    Ingen åpne aktiviteter. Få tips basert på dine preferanser.
                  </p>
                  <ButtonLink href="/flyt" variant="secondary" className="px-3 text-xs">
                    Utforsk tilbud
                  </ButtonLink>
                </>
              );
            })()}
          </div>
        </Card>
      </section>

      <section className="mt-6 space-y-4">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Forespørsler</p>
              <h2 className="text-lg font-semibold text-slate-900">Dine siste forespørsler</h2>
            </div>
            {leads.length > 3 && (
              <Link
                href="/dashboard/leads"
                className="text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Se alle
              </Link>
            )}
          </div>

          {status === 'loading' && (
            <p className="mt-3 text-sm text-slate-500">Laster forespørsler ...</p>
          )}

          {status === 'error' && (
            <Card className="mt-3 border-rose-200 bg-rose-50 text-sm text-rose-700">
              Klarte ikke hente forespørsler.
            </Card>
          )}

          {status === 'idle' && leads.length === 0 && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Du har ingen forespørsler ennå. Start en match for å komme i gang.
              <ButtonLink href="/flyt" className="mt-3 block text-center text-xs">
                Finn trening
              </ButtonLink>
            </div>
          )}

          {leads.length > 0 && (
            <div className="mt-3 space-y-3">
              {leads.slice(0, 3).map((lead) => (
                <Link
                  key={lead.id}
                  href={`/dashboard/leads/${lead.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 transition hover:border-slate-300"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {serviceMap.get(lead.service_id) ?? 'Ukjent tjeneste'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {lead.message.length > 80
                          ? `${lead.message.slice(0, 80)}…`
                          : lead.message}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {lead.status ?? 'Ny forespørsel'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {new Date(lead.created_at).toLocaleDateString('no-NO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span className="font-semibold text-slate-900">Se detaljer →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Bookinger</p>
              <h2 className="text-lg font-semibold text-slate-900">Neste avtaler</h2>
            </div>
            {customerBookings.length > 3 && (
              <Link href="/dashboard" className="text-xs font-medium text-slate-600 hover:text-slate-800">
                Se alle
              </Link>
            )}
          </div>

          {bookingsStatus === 'loading' && (
            <p className="mt-3 text-sm text-slate-500">Laster bookinger ...</p>
          )}

          {bookingsStatus === 'error' && (
            <Card className="mt-3 border-rose-200 bg-rose-50 text-sm text-rose-700">
              Klarte ikke hente bookinger.
            </Card>
          )}

          {(bookingsStatus === 'idle' || bookingsStatus === 'error') &&
            customerBookings.length === 0 && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Du har ingen bookinger akkurat nå.
              </div>
            )}

          {customerBookings.length > 0 && (
            <div className="mt-3 space-y-3">
              {customerBookings.slice(0, 3).map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Link
                        href={`/tilbyder/${booking.service_id}`}
                        className="text-base font-semibold text-slate-900"
                      >
                        {booking.service_name ?? booking.service_id}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {formatBookingTime(booking.scheduled_at)}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {bookingStatusLabel[booking.status]}
                    </span>
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
                  <form className="mt-3" action={cancelBookingAction}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="accessToken" value={session?.access_token ?? ''} />
                    <SubmitButton
                      variant="destructive"
                      disabled={booking.status === 'cancelled'}
                      pendingText="Avlyser ..."
                    >
                      Avlys
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Forslag</p>
              <h2 className="text-lg font-semibold text-slate-900">Forslag til deg</h2>
            </div>
            <Link
              href="/resultater"
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Se alle
            </Link>
          </div>

          {recommendationStatus === 'loading' && (
            <p className="mt-3 text-sm text-slate-500">Laster forslag ...</p>
          )}

          {recommendationStatus === 'error' && (
            <p className="mt-3 text-sm text-rose-600">Klarte ikke hente forslag akkurat nå.</p>
          )}

          {recommendations.length === 0 && recommendationStatus === 'idle' && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Ingen forslag ennå. Oppdater søket ditt for å få nye alternativer.
              <ButtonLink href="/flyt" className="mt-3 block text-center text-xs">
                Finn trening
              </ButtonLink>
            </div>
          )}

          {recommendations.length > 0 && (
            <div className="mt-3 space-y-3">
              {recommendations.slice(0, 3).map((recommendation) => (
                <div
                  key={recommendation.serviceId}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{recommendation.name}</p>
                      <p className="text-xs text-slate-500">{recommendation.description}</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {recommendation.priceLevel === 'low' ? 'Lav pris' : recommendation.priceLevel}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-rose-600">{recommendation.reason}</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <ButtonLink
                      href={`/tilbyder/${recommendation.serviceId}`}
                      className="w-full text-center text-sm"
                    >
                      Se tilbud
                    </ButtonLink>
                    <span className="text-xs text-slate-500">Gratis å sende forespørsel</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-6 space-y-6">
        <Card className="mt-10 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bedrift</h2>
            <p className="mt-1 text-sm text-slate-600">
              Samle ansatte i en bedrift og få en enkel oversikt.
            </p>
          </div>
        </div>

        {orgStatus === 'loading' && (
          <div className="mt-4 text-sm text-slate-500">Laster bedrift ...</div>
        )}

        {orgStatus === 'error' && (
          <Card className="mt-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
            {orgMessage || 'Kunne ikke hente bedrift.'}
          </Card>
        )}

        {orgStatus === 'idle' && !orgMembership && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card className="bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">Har du en kode?</h3>
              <p className="mt-1 text-xs text-slate-600">Bruk koden fra bedriften din.</p>
              <div className="mt-3 flex flex-col gap-2">
                <Input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="Join-kode"
                />
                <Button type="button" onClick={handleJoinOrg} disabled={orgActionStatus === 'loading'}>
                  Bli med
                </Button>
              </div>
            </Card>

            <Card className="bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">Opprett bedrift</h3>
              <p className="mt-1 text-xs text-slate-600">Lag en ny bedrift og inviter ansatte.</p>
              <div className="mt-3 flex flex-col gap-2">
                <Input
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                  placeholder="Bedriftsnavn"
                />
                <Button type="button" onClick={handleCreateOrg} disabled={orgActionStatus === 'loading'}>
                  Opprett
                </Button>
              </div>
            </Card>
          </div>
        )}

        {orgStatus === 'idle' && orgMembership && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-600">Du er med i</span>
              <span className="font-semibold text-slate-900">{orgMembership.organization.name}</span>
              <Chip className="bg-slate-200 text-slate-700">
                {orgMembership.role === 'admin' ? 'Admin' : 'Medlem'}
              </Chip>
            </div>
            {orgMembership.role === 'admin' && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-slate-600">Join-kode:</span>
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
                  {orgMembership.organization.join_code}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    if (navigator.clipboard) {
                      await navigator.clipboard.writeText(orgMembership.organization.join_code);
                    } else {
                      window.prompt('Kopier join-kode', orgMembership.organization.join_code);
                    }
                  }}
                >
                  Kopier kode
                </Button>
              </div>
            )}
            {orgMembership.role === 'admin' && (
              <ButtonLink href="/org-dashboard" variant="secondary">
                Gå til bedriftens oversikt
              </ButtonLink>
            )}
          </div>
        )}

        {orgMessage && orgStatus === 'idle' && (
          <p className="mt-3 text-xs text-rose-600">{orgMessage}</p>
        )}
      </Card>

      <Card className="mt-10 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Varslingsinnstillinger</h2>
            <p className="mt-1 text-sm text-slate-600">
              Velg hvilke e-poster du ønsker å motta.
            </p>
          </div>
          {prefStatus === 'saved' && (
            <span className="text-xs font-medium text-emerald-600">Lagret</span>
          )}
        </div>

        {prefStatus === 'loading' && (
          <div className="mt-4 text-sm text-slate-500">Laster preferanser ...</div>
        )}

        {prefStatus === 'error' && (
          <Card className="mt-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
            Klarte ikke å hente preferanser.
          </Card>
        )}

        {preferences && (
          <form onSubmit={handlePreferenceSubmit} className="mt-4 space-y-4">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                checked={preferences.email_lead_created}
                onChange={handlePreferenceToggle('email_lead_created')}
              />
              <span>E-post når jeg får ny forespørsel (tilbyder).</span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                checked={preferences.email_provider_replied}
                onChange={handlePreferenceToggle('email_provider_replied')}
              />
              <span>E-post når jeg får svar på forespørsel (bruker).</span>
            </label>
            <Button type="submit" disabled={prefStatus === 'saving'}>
              {prefStatus === 'saving' ? 'Lagrer ...' : 'Lagre'}
            </Button>
          </form>
        )}
      </Card>

      <Card className="mt-10 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dine data</h2>
            <p className="mt-1 text-sm text-slate-600">
              Se hva vi har lagret, eksporter eller slett kontoen din.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={handleLoadData} disabled={dataStatus === 'loading'}>
            {dataStatus === 'loading' ? 'Henter ...' : 'Se innhold'}
          </Button>
          <Button type="button" onClick={handleExport} disabled={exportStatus === 'loading'}>
            {exportStatus === 'loading' ? 'Lager fil ...' : 'Eksporter data (JSON)'}
          </Button>
        </div>

        {dataStatus === 'error' && (
          <Card className="mt-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
            Klarte ikke å hente dataene dine.
          </Card>
        )}

        {dataSummary && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Card className="bg-slate-50 text-sm text-slate-700">
              Leads: <span className="font-semibold text-slate-900">{dataSummary.leads}</span>
            </Card>
            <Card className="bg-slate-50 text-sm text-slate-700">
              Meldinger:{' '}
              <span className="font-semibold text-slate-900">{dataSummary.messages}</span>
            </Card>
            <Card className="bg-slate-50 text-sm text-slate-700">
              Vurderinger:{' '}
              <span className="font-semibold text-slate-900">{dataSummary.reviews}</span>
            </Card>
            <Card className="bg-slate-50 text-sm text-slate-700">
              Samtykker:{' '}
              <span className="font-semibold text-slate-900">{dataSummary.consents}</span>
            </Card>
          </div>
        )}

        {exportStatus === 'error' && (
          <Card className="mt-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
            Klarte ikke å eksportere dataene dine.
          </Card>
        )}

        {exportStatus === 'done' && (
          <Card className="mt-4 border-emerald-200 bg-emerald-50 text-sm text-emerald-700">
            Eksport klar. Filen er lastet ned.
          </Card>
        )}

        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">Slett konto</h3>
          <p className="mt-2 text-sm text-slate-600">
            Dette fjerner personlige data fra kontoen din. Handlingen kan ikke angres.
          </p>

          {deleteStatus === 'error' && (
            <Card className="mt-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
              {deleteMessage || 'Kunne ikke slette kontoen.'}
            </Card>
          )}

          {!['done', 'processing'].includes(deleteStatus) && (
            <div className="mt-4 flex flex-wrap gap-3">
              {deleteStatus === 'confirm' ? (
                <>
                  <Button type="button" onClick={handleDelete}>
                    Bekreft sletting
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setDeleteStatus('idle')}>
                    Avbryt
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDeleteStatus('confirm')}
                >
                  Slett konto
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
      </section>
    </main>
  );
}

