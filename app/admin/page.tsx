'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import {
  bulkInviteProviders,
  createProviderInvite,
  exportEventSummary,
  exportLeadsSummary,
  exportServicesData,
  getAdminConsentMetrics,
  getAdminMetrics,
  getAdminOverview,
  getAdminOrganizations,
  getAppErrors,
  getDeletionRequests,
  getFeedbackList,
  getProviderInvites,
  getServiceQuality,
  isAdmin,
  markAppErrorKnown,
  toggleServiceActive,
  type AdminMetrics,
  type AdminOverviewState,
  type AdminOrganizationOverview,
  type AppErrorRow,
  type ConsentMetrics,
  type DeletionRequestRow,
  type FeedbackRow,
  type ProviderInviteRow,
  type ServiceQualityRow,
} from './actions';
import { ENABLE_ADMIN, ENABLE_PILOT_MODE } from '../../lib/featureFlags';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Input, Textarea } from '../../components/ui/Input';
import { container, label } from '../../lib/ui';

type AdminStatus = 'loading' | 'ready' | 'error';

type ErrorBusyState = Record<string, boolean>;

type BulkResult = { line: string; ok: boolean; message: string; link?: string };

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [adminState, setAdminState] = useState<'unknown' | 'ok' | 'nope'>('unknown');
  const [overview, setOverview] = useState<AdminOverviewState>({
    ok: false,
    services: [],
  });
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [consentMetrics, setConsentMetrics] = useState<ConsentMetrics | null>(null);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequestRow[]>([]);
  const [appErrors, setAppErrors] = useState<AppErrorRow[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackRow[]>([]);
  const [invites, setInvites] = useState<ProviderInviteRow[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganizationOverview[]>([]);
  const [qualityRows, setQualityRows] = useState<ServiceQualityRow[]>([]);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [status, setStatus] = useState<AdminStatus>('loading');
  const [busyServiceId, setBusyServiceId] = useState<string | null>(null);
  const [errorBusy, setErrorBusy] = useState<ErrorBusyState>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteServiceId, setInviteServiceId] = useState('');
  const [inviteStatus, setInviteStatus] = useState<{
    ok: boolean;
    message: string;
    link?: string;
  }>({ ok: false, message: '' });
  const [exportStatus, setExportStatus] = useState('');
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'loading'>('idle');

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  useEffect(() => {
    if (!ENABLE_ADMIN) {
      setAdminState('nope');
      setStatus('error');
      return;
    }
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
    const loadAdmin = async () => {
      setStatus('loading');
      const adminOk = await isAdmin(session.access_token);
      if (!adminOk) {
        setAdminState('nope');
        router.replace('/');
        return;
      }
      setAdminState('ok');
      const [
        data,
        metricData,
        consentData,
        deletionData,
        errorData,
        feedbackData,
        inviteData,
        orgData,
        qualityData,
      ] = await Promise.all([
        getAdminOverview(session.access_token),
        getAdminMetrics(session.access_token),
        getAdminConsentMetrics(session.access_token),
        getDeletionRequests(session.access_token),
        getAppErrors(session.access_token),
        getFeedbackList(session.access_token),
        getProviderInvites(session.access_token),
        getAdminOrganizations(session.access_token),
        getServiceQuality(session.access_token),
      ]);
      setOverview(data);
      setMetrics(metricData);
      setConsentMetrics(consentData);
      setDeletionRequests(deletionData);
      setAppErrors(errorData);
      setFeedbackList(feedbackData);
      setInvites(inviteData);
      setOrganizations(orgData);
      setQualityRows(qualityData);
      setStatus(data.ok ? 'ready' : 'error');
    };
    loadAdmin();
  }, [session?.access_token, router]);

  const handleToggle = async (serviceId: string, active: boolean) => {
    if (!session?.access_token) return;
    if (!active) {
      const confirmDeactivate = window.confirm(
        'Er du sikker på at du vil deaktivere denne tjenesten?'
      );
      if (!confirmDeactivate) return;
    }
    setBusyServiceId(serviceId);
    const result = await toggleServiceActive(session.access_token, serviceId, active);
    if (result.ok) {
      setOverview((prev) => ({
        ...prev,
        services: prev.services.map((service) =>
          service.id === serviceId ? { ...service, is_active: active } : service
        ),
      }));
    }
    setBusyServiceId(null);
  };

  const handleMarkKnown = async (errorId: string, known: boolean) => {
    if (!session?.access_token) return;
    setErrorBusy((prev) => ({ ...prev, [errorId]: true }));
    const result = await markAppErrorKnown(session.access_token, errorId, known);
    if (result.ok) {
      setAppErrors((prev) =>
        prev.map((error) =>
          error.id === errorId
            ? {
                ...error,
                metadata: {
                  ...(error.metadata ?? {}),
                  known_issue: known,
                },
              }
            : error
        )
      );
    }
    setErrorBusy((prev) => ({ ...prev, [errorId]: false }));
  };

  const reloadInvites = async () => {
    if (!session?.access_token) return;
    const data = await getProviderInvites(session.access_token);
    setInvites(data);
  };

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isSupabaseConfigured) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
          <p className="mt-3 text-sm text-slate-600">
            Supabase er ikke konfigurert. Legg inn miljøvariabler for å bruke admin-panelet.
          </p>
        </Card>
      </main>
    );
  }

  if (!session || adminState === 'nope') {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
          <p className="mt-3 text-sm text-slate-600">
            {ENABLE_ADMIN
              ? 'Du har ikke tilgang til denne siden.'
              : 'Admin-panelet er deaktivert i produksjonsmodus.'}
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${container} py-12`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tjenester og leads</h1>
        </div>
      </div>

      {ENABLE_PILOT_MODE && (
        <Card className="mt-6 border-amber-200 bg-amber-50 text-sm text-amber-700">
          Pilot - funksjoner kan endres.
        </Card>
      )}

      {status === 'loading' && (
        <div className="mt-6 text-sm text-slate-500">Laster admin-oversikt ...</div>
      )}

      {status === 'error' && (
        <Card className="mt-6 border-rose-200 bg-rose-50 text-sm text-rose-700">
          Klarte ikke å hente admin-oversikten.
        </Card>
      )}

      {status === 'ready' && (
        <>
          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Inviter tilbydere
            </h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <form
                className="grid gap-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!session?.access_token) return;
                  const result = await createProviderInvite(
                    session.access_token,
                    inviteEmail,
                    inviteServiceId || null
                  );
                  setInviteStatus({ ok: result.ok, message: result.message, link: result.link });
                  if (result.ok) {
                    setInviteEmail('');
                    setInviteServiceId('');
                    await reloadInvites();
                  }
                }}
              >
                <div className="grid gap-2">
                  <label htmlFor="invite-email" className={label}>
                    E-post
                  </label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="tilbyder@firma.no"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="invite-service" className={label}>
                    Knytt til tjeneste (valgfritt)
                  </label>
                  <select
                    id="invite-service"
                    value={inviteServiceId}
                    onChange={(event) => setInviteServiceId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Ikke valgt</option>
                    {overview.services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit">Send invitasjon</Button>
                {inviteStatus.message && (
                  <p
                    className={`text-xs ${
                      inviteStatus.ok ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {inviteStatus.message}
                  </p>
                )}
                {inviteStatus.link && (
                  <div className="text-xs text-slate-500">
                    {inviteStatus.link}
                  </div>
                )}
              </form>
              <div>
                <label className={label}>Importer (CSV/paste)</label>
                <p className="mt-1 text-xs text-slate-500">Format: email,service_id (valgfri)</p>
                <Textarea
                  rows={6}
                  value={bulkText}
                  onChange={(event) => setBulkText(event.target.value)}
                  placeholder="mail@firma.no,service_123"
                />
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    type="button"
                    disabled={bulkStatus === 'loading'}
                    onClick={async () => {
                      if (!session?.access_token) return;
                      setBulkStatus('loading');
                      const result = await bulkInviteProviders(session.access_token, bulkText);
                      setBulkResults(result.results);
                      setBulkStatus('idle');
                      await reloadInvites();
                    }}
                  >
                    {bulkStatus === 'loading' ? 'Sender ...' : 'Send invitasjoner'}
                  </Button>
                </div>
                {bulkResults.length > 0 && (
                  <div className="mt-4 space-y-2 text-xs">
                    {bulkResults.map((row, index) => (
                      <div
                        key={`${row.line}-${index}`}
                        className={`rounded-lg border px-3 py-2 ${
                          row.ok
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}
                      >
                        <div className="font-semibold">{row.line}</div>
                        <div>{row.message}</div>
                        {row.link && <div className="mt-1 text-slate-600">{row.link}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Siste invitasjoner
              </h3>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {invites.map((invite) => {
                  const link = baseUrl ? `${baseUrl}/invite/${invite.token}` : '';
                  return (
                    <div
                      key={invite.id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{invite.email}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(invite.created_at).toLocaleString('no-NO')}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <Chip className="bg-slate-200 text-slate-700">
                          {invite.accepted_at ? 'Godtatt' : 'Avventer'}
                        </Chip>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={async () => {
                            if (!link) return;
                            if (navigator.clipboard) {
                              await navigator.clipboard.writeText(link);
                            } else {
                              window.prompt('Kopier lenke', link);
                            }
                          }}
                        >
                          Kopier lenke
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {invites.length === 0 && (
                  <div className="text-sm text-slate-600">Ingen invitasjoner sendt ennå.</div>
                )}
              </div>
            </div>
          </Card>

          <Card className="mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Kvalitet
                </h2>
                <p className="text-xs text-slate-500">Siste 30 dager</p>
              </div>
            </div>
            {qualityRows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">Ingen kvalitetshendelser registrert.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {qualityRows.map((row) => (
                  <div
                    key={row.service_id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.service_name ?? row.service_id}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.late_cancellations} sene avbestillinger · {row.no_shows} no-show
                      </p>
                    </div>
                    <Chip variant="accent" className="text-xs">
                      Kvalitet {row.quality_score}
                    </Chip>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Eksport
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Eksportert data kan inneholde personopplysninger.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={exportBusy === 'services'}
                onClick={async () => {
                  if (!session?.access_token) return;
                  setExportBusy('services');
                  const result = await exportServicesData(session.access_token);
                  if (result.ok && result.data) {
                    downloadJson('services-export.json', result.data);
                  }
                  setExportStatus(result.message);
                  setExportBusy(null);
                }}
              >
                Eksporter tjenester
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={exportBusy === 'leads'}
                onClick={async () => {
                  if (!session?.access_token) return;
                  setExportBusy('leads');
                  const result = await exportLeadsSummary(session.access_token);
                  if (result.ok && result.data) {
                    downloadJson('leads-summary.json', result.data);
                  }
                  setExportStatus(result.message);
                  setExportBusy(null);
                }}
              >
                Eksporter leads (anonymisert)
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={exportBusy === 'events'}
                onClick={async () => {
                  if (!session?.access_token) return;
                  setExportBusy('events');
                  const result = await exportEventSummary(session.access_token);
                  if (result.ok && result.data) {
                    downloadJson('events-summary.json', result.data);
                  }
                  setExportStatus(result.message);
                  setExportBusy(null);
                }}
              >
                Eksporter events
              </Button>
            </div>
            {exportStatus && <p className="mt-3 text-xs text-slate-600">{exportStatus}</p>}
          </Card>

          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Bedrifter
            </h2>
            <div className="mt-4 space-y-3">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{org.name}</div>
                    <div className="text-xs text-slate-500">ID: {org.id}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <Chip className="bg-slate-200 text-slate-700">
                      {org.subscription_status === 'active'
                        ? 'Aktivt'
                        : org.subscription_status === 'past_due'
                        ? 'Forfalt'
                        : 'Inaktivt'}
                    </Chip>
                    <span className="text-slate-500">Medlemmer: {org.members_count}</span>
                    <span className="text-slate-500">Leads: {org.leads_count}</span>
                  </div>
                </div>
              ))}
              {organizations.length === 0 && (
                <div className="text-sm text-slate-600">Ingen bedrifter registrert.</div>
              )}
            </div>
          </Card>

          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Produktinnsikt
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Card className="bg-slate-50">
                <div className="text-xs uppercase tracking-wide text-slate-500">Søk</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {metrics?.searches_7d ?? 0}
                </div>
                <div className="text-xs text-slate-500">Siste 7 dager</div>
                <div className="mt-2 text-sm text-slate-600">
                  30d: {metrics?.searches_30d ?? 0}
                </div>
              </Card>
              <Card className="bg-slate-50">
                <div className="text-xs uppercase tracking-wide text-slate-500">Profilvisninger</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {metrics?.profiles_7d ?? 0}
                </div>
                <div className="text-xs text-slate-500">Siste 7 dager</div>
                <div className="mt-2 text-sm text-slate-600">
                  30d: {metrics?.profiles_30d ?? 0}
                </div>
              </Card>
              <Card className="bg-slate-50">
                <div className="text-xs uppercase tracking-wide text-slate-500">Leads</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {metrics?.leads_7d ?? 0}
                </div>
                <div className="text-xs text-slate-500">Siste 7 dager</div>
                <div className="mt-2 text-sm text-slate-600">
                  30d: {metrics?.leads_30d ?? 0}
                </div>
              </Card>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mest besøkte tjenester
              </h3>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {(metrics?.top_services ?? []).map((service) => (
                  <div
                    key={service.service_id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2"
                  >
                    <span className="font-medium text-slate-900">
                      {service.service_name ?? service.service_id}
                    </span>
                    <span className="text-xs text-slate-500">{service.views} visninger</span>
                  </div>
                ))}
                {(metrics?.top_services ?? []).length === 0 && (
                  <div className="text-sm text-slate-600">Ingen data enda.</div>
                )}
              </div>
            </div>
          </Card>

          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Feedback
            </h2>
            <div className="mt-4 space-y-3">
              {feedbackList.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip className="bg-slate-200 text-slate-700">{item.role}</Chip>
                      <span>{item.page || 'Ukjent side'}</span>
                    </div>
                    <span>{new Date(item.created_at).toLocaleString('no-NO')}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {item.message.length > 180 ? `${item.message.slice(0, 180)}...` : item.message}
                  </p>
                </div>
              ))}
              {feedbackList.length === 0 && (
                <div className="text-sm text-slate-600">Ingen feedback mottatt ennå.</div>
              )}
            </div>
          </Card>

          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Samtykker
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Card className="bg-slate-50">
                <div className="text-xs uppercase tracking-wide text-slate-500">Brukere</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {consentMetrics?.totalUsers ?? 0}
                </div>
                <div className="text-xs text-slate-500">Totalt registrert</div>
              </Card>
              <Card className="bg-slate-50">
                <div className="text-xs uppercase tracking-wide text-slate-500">Gyldig samtykke</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {consentMetrics?.usersWithConsent ?? 0}
                </div>
                <div className="text-xs text-slate-500">Vilkår + personvern</div>
              </Card>
              <Card className="bg-slate-50">
                <div className="text-xs uppercase tracking-wide text-slate-500">Dekning</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {consentMetrics?.consentRate ?? 0}%
                </div>
                <div className="text-xs text-slate-500">Andel med samtykke</div>
              </Card>
            </div>
          </Card>

          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Sletteforespørsler
            </h2>
            <div className="mt-4 space-y-3">
              {deletionRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {request.user_email ?? request.user_id}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(request.requested_at).toLocaleString('no-NO')}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <Chip className="bg-slate-200 text-slate-700">
                      {request.status === 'completed' ? 'Fullført' : 'Mottatt'}
                    </Chip>
                    {request.completed_at && (
                      <span className="text-slate-500">
                        Fullført: {new Date(request.completed_at).toLocaleString('no-NO')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {deletionRequests.length === 0 && (
                <div className="text-sm text-slate-600">Ingen sletteforespørsler.</div>
              )}
            </div>
          </Card>

          <Card className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Feillogg
            </h2>
            <div className="mt-4 space-y-2">
              {appErrors.map((error) => {
                const isExpanded = expandedErrorId === error.id;
                const shortMessage =
                  error.message.length > 140
                    ? `${error.message.slice(0, 140)}...`
                    : error.message;
                const isKnown = Boolean(error.metadata?.known_issue);
                return (
                  <div key={error.id} className="rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedErrorId((prev) => (prev === error.id ? null : error.id))
                      }
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {error.context ?? 'Ukjent kontekst'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(error.created_at).toLocaleString('no-NO')}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-600 sm:mt-0 sm:text-right">
                        {error.user_email ?? error.user_id ?? 'Ukjent bruker'}
                      </div>
                    </button>
                    <div className="border-t border-slate-200 px-4 pb-3 text-sm text-slate-600">
                      <p className="mt-3">{shortMessage}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        {isKnown && (
                          <Chip className="bg-emerald-100 text-emerald-700">Kjent problem</Chip>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={errorBusy[error.id]}
                          onClick={() => handleMarkKnown(error.id, !isKnown)}
                        >
                          {isKnown ? 'Fjern kjent' : 'Marker som kjent'}
                        </Button>
                      </div>
                      {isExpanded && (
                        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                          {error.source && (
                            <div>
                              <span className="font-semibold">Kilde:</span> {error.source}
                            </div>
                          )}
                          {error.stack && (
                            <pre className="whitespace-pre-wrap text-[11px] text-slate-600">
                              {error.stack}
                            </pre>
                          )}
                          {error.metadata && (
                            <pre className="whitespace-pre-wrap text-[11px] text-slate-600">
                              {JSON.stringify(error.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {appErrors.length === 0 && (
                <div className="text-sm text-slate-600">Ingen feil logget.</div>
              )}
            </div>
          </Card>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[2fr_1.5fr_0.5fr_0.7fr_0.8fr]">
              <div>Tjeneste</div>
              <div>Eier</div>
              <div>Leads</div>
              <div>Status</div>
              <div>Handling</div>
            </div>
            <div className="divide-y divide-slate-200">
              {overview.services.map((service) => (
                <div
                  key={service.id}
                  className="grid grid-cols-1 gap-4 px-6 py-4 text-sm text-slate-700 sm:grid-cols-[2fr_1.5fr_0.5fr_0.7fr_0.8fr] sm:items-center"
                >
                  <div className="font-semibold text-slate-900">{service.name}</div>
                  <div className="text-sm text-slate-600">
                    {service.owner_email ?? 'Ikke claimet'}
                  </div>
                  <div>{service.leads_count}</div>
                  <div>
                    {service.is_active ? (
                      <Chip variant="accent">Aktiv</Chip>
                    ) : (
                      <Chip className="bg-amber-100 text-amber-700">Deaktivert</Chip>
                    )}
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleToggle(service.id, !service.is_active)}
                      disabled={busyServiceId === service.id}
                    >
                      {service.is_active ? 'Deaktiver' : 'Aktiver'}
                    </Button>
                  </div>
                </div>
              ))}
              {overview.services.length === 0 && (
                <div className="px-6 py-6 text-sm text-slate-600">Ingen tjenester funnet.</div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}


