'use server';

import { createClient } from '@supabase/supabase-js';
import { getConsentMetrics } from '../../lib/consents';
import { ENABLE_ADMIN, ENABLE_EMAILS } from '../../lib/featureFlags';
import { sendEmail, isEmailConfigured } from '../../lib/emailClient';
import { providerInviteEmail } from '../../lib/emailTemplates';
import { logError } from '../../lib/errorLogger';
import { invalidateServiceCaches } from '../../lib/cacheInvalidation';
import { isAdminByEmail } from '../../lib/adminHelper';
import crypto from 'crypto';

export type AdminServiceOverview = {
  id: string;
  name: string;
  is_active: boolean;
  owner_email: string | null;
  leads_count: number;
};

export type AdminOverviewState = {
  ok: boolean;
  message?: string;
  services: AdminServiceOverview[];
};

export type AdminMetrics = {
  searches_7d: number;
  searches_30d: number;
  profiles_7d: number;
  profiles_30d: number;
  leads_7d: number;
  leads_30d: number;
  top_services: { service_id: string; service_name: string | null; views: number }[];
};

export type ConsentMetrics = {
  totalUsers: number;
  usersWithConsent: number;
  consentRate: number;
};

export type DeletionRequestRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  status: string;
  requested_at: string;
  completed_at: string | null;
};

export type AppErrorRow = {
  id: string;
  level: string;
  source: string | null;
  context: string | null;
  message: string;
  stack: string | null;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
};

export type FeedbackRow = {
  id: string;
  role: 'user' | 'provider' | 'admin';
  page: string | null;
  message: string;
  created_at: string;
};

export type ProviderInviteRow = {
  id: string;
  email: string;
  token: string;
  service_id: string | null;
  created_at: string;
  accepted_at: string | null;
};

export type ServiceQualityRow = {
  service_id: string;
  service_name: string | null;
  late_cancellations: number;
  no_shows: number;
  quality_score: number;
};

export type ExportResult<T> = {
  ok: boolean;
  message: string;
  data: T | null;
};

export type AdminOrganizationOverview = {
  id: string;
  name: string;
  subscription_status: 'inactive' | 'active' | 'past_due';
  members_count: number;
  leads_count: number;
};

const getSupabase = (accessToken?: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
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

const getAdminEmail = () => process.env.ADMIN_EMAIL?.toLowerCase() ?? '';

export async function isAdmin(accessToken: string): Promise<boolean> {
  return isAdminByEmail(accessToken);
}

export async function getAdminOverview(accessToken: string): Promise<AdminOverviewState> {
  if (!ENABLE_ADMIN) {
    return { ok: false, message: 'Admin er deaktivert.', services: [] };
  }

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) {
    return { ok: false, message: 'Ikke autorisert.', services: [] };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.', services: [] };
  }

  const { data: services } = await adminClient
    .from('services')
    .select('id, name, owner_user_id, is_active');

  const serviceList =
    services?.map((service) => ({
      id: service.id as string,
      name: service.name as string,
      owner_user_id: service.owner_user_id as string | null,
      is_active: Boolean(service.is_active),
    })) ?? [];

  const { data: leads } = await adminClient.from('leads').select('id, service_id');

  const leadCountMap = new Map<string, number>();
  (leads ?? []).forEach((lead) => {
    const serviceId = lead.service_id as string;
    leadCountMap.set(serviceId, (leadCountMap.get(serviceId) ?? 0) + 1);
  });

  const ownerIds = Array.from(
    new Set(serviceList.map((service) => service.owner_user_id).filter(Boolean))
  ) as string[];

  let ownerEmailMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email')
      .in('id', ownerIds);

    ownerEmailMap = new Map(
      (profiles ?? [])
        .filter((profile) => profile.email)
        .map((profile) => [profile.id as string, profile.email as string])
    );
  }

  const overview = serviceList.map((service) => ({
    id: service.id,
    name: service.name,
    is_active: service.is_active,
    owner_email: service.owner_user_id ? ownerEmailMap.get(service.owner_user_id) ?? null : null,
    leads_count: leadCountMap.get(service.id) ?? 0,
  }));

  return { ok: true, services: overview };
}

export async function getAdminOrganizations(
  accessToken: string
): Promise<AdminOrganizationOverview[]> {
  if (!ENABLE_ADMIN) return [];

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) return [];

  const adminClient = getServiceSupabase();
  if (!adminClient) return [];

  const { data: organizations } = await adminClient
    .from('organizations')
    .select('id, name, subscription_status');

  const { data: members } = await adminClient
    .from('organization_members')
    .select('organization_id');

  const { data: leadStats } = await adminClient
    .from('organization_lead_stats')
    .select('organization_id');

  const memberCountMap = new Map<string, number>();
  (members ?? []).forEach((row) => {
    const orgId = row.organization_id as string;
    memberCountMap.set(orgId, (memberCountMap.get(orgId) ?? 0) + 1);
  });

  const leadCountMap = new Map<string, number>();
  (leadStats ?? []).forEach((row) => {
    const orgId = row.organization_id as string;
    leadCountMap.set(orgId, (leadCountMap.get(orgId) ?? 0) + 1);
  });

  return (organizations ?? []).map((org) => ({
    id: org.id as string,
    name: org.name as string,
    subscription_status: (org.subscription_status as AdminOrganizationOverview['subscription_status']) ?? 'inactive',
    members_count: memberCountMap.get(org.id as string) ?? 0,
    leads_count: leadCountMap.get(org.id as string) ?? 0,
  }));
}

export async function toggleServiceActive(
  accessToken: string,
  serviceId: string,
  active: boolean
): Promise<{ ok: boolean; message: string }> {
  if (!ENABLE_ADMIN) {
    return { ok: false, message: 'Admin er deaktivert.' };
  }

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) {
    return { ok: false, message: 'Ikke autorisert.' };
  }

  const supabase = getSupabase(accessToken);
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { error } = await supabase
    .from('services')
    .update({ is_active: active })
    .eq('id', serviceId);

  if (error) {
    return { ok: false, message: 'Kunne ikke oppdatere tjenesten.' };
  }

  await invalidateServiceCaches(serviceId);

  return { ok: true, message: 'Oppdatert.' };
}

const countEvents = async (
  adminClient: any,
  type: string,
  since: string
) => {
  const { count } = await adminClient
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('type', type)
    .gte('created_at', since);

  return count ?? 0;
};

export async function getAdminMetrics(accessToken: string): Promise<AdminMetrics | null> {
  if (!ENABLE_ADMIN) return null;

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) return null;

  const adminClient = getServiceSupabase();
  if (!adminClient) return null;

  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    searches7,
    searches30,
    profiles7,
    profiles30,
    leads7,
    leads30,
  ] = await Promise.all([
    countEvents(adminClient, 'search_performed', since7),
    countEvents(adminClient, 'search_performed', since30),
    countEvents(adminClient, 'profile_viewed', since7),
    countEvents(adminClient, 'profile_viewed', since30),
    countEvents(adminClient, 'lead_created', since7),
    countEvents(adminClient, 'lead_created', since30),
  ]);

  const { data: topViews } = await adminClient
    .from('events')
    .select('service_id, count:service_id')
    .eq('type', 'profile_viewed')
    .not('service_id', 'is', null);

  const topCounts = (topViews ?? [])
    .map((row) => ({
      service_id: row.service_id as string,
      views: Number(row.count ?? 0),
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const topIds = topCounts.map((row) => row.service_id);
  let serviceNameMap = new Map<string, string>();
  if (topIds.length > 0) {
    const { data: serviceRows } = await adminClient
      .from('services')
      .select('id, name')
      .in('id', topIds);
    serviceNameMap = new Map(
      (serviceRows ?? []).map((service) => [service.id as string, service.name as string])
    );
  }

  const topServices = topCounts.map((row) => ({
    service_id: row.service_id,
    service_name: serviceNameMap.get(row.service_id) ?? null,
    views: row.views,
  }));

  return {
    searches_7d: searches7,
    searches_30d: searches30,
    profiles_7d: profiles7,
    profiles_30d: profiles30,
    leads_7d: leads7,
    leads_30d: leads30,
    top_services: topServices,
  };
}

export async function getServiceQuality(accessToken: string): Promise<ServiceQualityRow[]> {
  if (!ENABLE_ADMIN) return [];

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) return [];

  const adminClient = getServiceSupabase();
  if (!adminClient) return [];

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await adminClient
    .from('quality_events')
    .select('service_id, type')
    .gte('created_at', since);

  const counts = new Map<string, { late: number; noShow: number }>();
  (data ?? []).forEach((row) => {
    const serviceId = row.service_id as string | null;
    if (!serviceId) return;
    if (!counts.has(serviceId)) {
      counts.set(serviceId, { late: 0, noShow: 0 });
    }
    const current = counts.get(serviceId);
    if (!current) return;
    if (row.type === 'late_cancellation') {
      current.late += 1;
    } else if (row.type === 'no_show') {
      current.noShow += 1;
    }
  });

  const summary = Array.from(counts.entries()).map(([serviceId, metrics]) => ({
    service_id: serviceId,
    service_name: null,
    late_cancellations: metrics.late,
    no_shows: metrics.noShow,
    quality_score: Math.max(0, 100 - (metrics.late * 5 + metrics.noShow * 10)),
  }));

  if (summary.length === 0) {
    return [];
  }

  const serviceIds = summary.map((row) => row.service_id);
  const { data: serviceRows } = await adminClient
    .from('services')
    .select('id, name')
    .in('id', serviceIds);

  const nameMap = new Map<string, string>();
  (serviceRows ?? []).forEach((service) => {
    if (service.id && service.name) {
      nameMap.set(service.id as string, service.name as string);
    }
  });

  return summary
    .map((row) => ({
      ...row,
      service_name: nameMap.get(row.service_id) ?? null,
    }))
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, 20);
}

export async function getAdminConsentMetrics(
  accessToken: string
): Promise<ConsentMetrics | null> {
  if (!ENABLE_ADMIN) return null;

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) return null;

  const metrics = await getConsentMetrics();
  if (!metrics) return null;

  return {
    totalUsers: metrics.totalUsers,
    usersWithConsent: metrics.usersWithConsent,
    consentRate: metrics.consentRate,
  };
}

export async function getDeletionRequests(
  accessToken: string
): Promise<DeletionRequestRow[]> {
  if (!ENABLE_ADMIN) return [];

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) return [];

  const adminClient = getServiceSupabase();
  if (!adminClient) return [];

  const { data: requests } = await adminClient
    .from('deletion_requests')
    .select('id, user_id, status, requested_at, completed_at')
    .order('requested_at', { ascending: false });

  const userIds = Array.from(new Set((requests ?? []).map((row) => row.user_id as string)));

  let emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    emailMap = new Map(
      (profiles ?? [])
        .filter((profile) => profile.email)
        .map((profile) => [profile.id as string, profile.email as string])
    );
  }

  return (requests ?? []).map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    user_email: emailMap.get(row.user_id as string) ?? null,
    status: row.status as string,
    requested_at: row.requested_at as string,
    completed_at: row.completed_at as string | null,
  }));
}

export async function getAppErrors(accessToken: string): Promise<AppErrorRow[]> {
  if (!ENABLE_ADMIN) return [];

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) return [];

  const adminClient = getServiceSupabase();
  if (!adminClient) return [];

  const { data: errors } = await adminClient
    .from('app_errors')
    .select('id, level, source, context, message, stack, metadata, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const userIds = Array.from(
    new Set((errors ?? []).map((row) => row.user_id).filter(Boolean))
  ) as string[];

  let emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    emailMap = new Map(
      (profiles ?? [])
        .filter((profile) => profile.email)
        .map((profile) => [profile.id as string, profile.email as string])
    );
  }

  return (errors ?? []).map((row) => ({
    id: row.id as string,
    level: row.level as string,
    source: row.source as string | null,
    context: row.context as string | null,
    message: row.message as string,
    stack: row.stack as string | null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    user_id: row.user_id as string | null,
    user_email: row.user_id ? emailMap.get(row.user_id as string) ?? null : null,
    created_at: row.created_at as string,
  }));
}

export async function markAppErrorKnown(
  accessToken: string,
  errorId: string,
  known: boolean
): Promise<{ ok: boolean; message: string }> {
  if (!ENABLE_ADMIN) {
    return { ok: false, message: 'Admin er deaktivert.' };
  }

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) {
    return { ok: false, message: 'Ikke autorisert.' };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: current } = await adminClient
    .from('app_errors')
    .select('metadata')
    .eq('id', errorId)
    .maybeSingle();

  const nextMetadata = {
    ...(current?.metadata as Record<string, unknown> | null),
    known_issue: known,
  };

  const { error } = await adminClient
    .from('app_errors')
    .update({ metadata: nextMetadata })
    .eq('id', errorId);

  if (error) {
    return { ok: false, message: 'Kunne ikke oppdatere feillogg.' };
  }

  return { ok: true, message: 'Oppdatert.' };
}

export async function getFeedbackList(accessToken: string): Promise<FeedbackRow[]> {
  if (!ENABLE_ADMIN) return [];

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) return [];

  const adminClient = getServiceSupabase();
  if (!adminClient) return [];

  const { data } = await adminClient
    .from('feedback')
    .select('id, role, page, message, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as 'user' | 'provider' | 'admin',
    page: (row.page as string | null) ?? null,
    message: row.message as string,
    created_at: row.created_at as string,
  }));
}

const createInviteToken = () => crypto.randomBytes(32).toString('hex');

const buildInviteLink = (token: string) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${appUrl}/invite/${token}`;
};

const createInviteRecord = async (
  adminClient: any,
  params: { email: string; serviceId?: string | null; createdBy?: string | null }
) => {
  const token = createInviteToken();
  const { data, error } = await adminClient
    .from('provider_invites')
    .insert({
      email: params.email,
      token,
      service_id: params.serviceId ?? null,
      created_by: params.createdBy ?? null,
    } as any)
    .select('id, email, token, service_id, created_at, accepted_at')
    .single();

  if (error || !data) {
    return { ok: false, message: 'Kunne ikke opprette invitasjon.' };
  }

  return { ok: true, invite: data as ProviderInviteRow };
};

export async function createProviderInvite(
  accessToken: string,
  email: string,
  serviceId?: string | null
): Promise<{ ok: boolean; message: string; link?: string }> {
  if (!ENABLE_ADMIN) {
    return { ok: false, message: 'Admin er deaktivert.' };
  }

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) {
    return { ok: false, message: 'Ikke autorisert.' };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { ok: false, message: 'E-post mangler.' };
  }

  if (serviceId) {
    const { data: service } = await adminClient
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .maybeSingle();
    if (!service) {
      return { ok: false, message: 'Fant ikke tjenesten.' };
    }
  }

  const { data: userData } = await adminClient.auth.getUser(accessToken);
  const createdBy = userData.user?.id ?? null;

  const created = await createInviteRecord(adminClient, {
    email: cleanEmail,
    serviceId: serviceId ?? null,
    createdBy,
  });

  if (!created.ok || !created.invite) {
    return { ok: false, message: created.message ?? 'Kunne ikke opprette invitasjon.' };
  }

  const link = buildInviteLink(created.invite.token);

  if (ENABLE_EMAILS && isEmailConfigured) {
    const emailContent = providerInviteEmail({ inviteLink: link });
    const sendResult = await sendEmail({
      to: cleanEmail,
      subject: emailContent.subject,
      body: emailContent.body,
    });
    if (!sendResult.ok) {
      await logError({
        level: 'warn',
        source: 'server_action',
        context: 'provider_invite',
        message: sendResult.message ?? 'Kunne ikke sende invite e-post.',
        metadata: { email: cleanEmail },
      });
    }
  }

  return {
    ok: true,
    message: ENABLE_EMAILS && isEmailConfigured ? 'Invitasjon sendt.' : 'Invitasjon opprettet.',
    link,
  };
}

export async function getProviderInvites(
  accessToken: string
): Promise<ProviderInviteRow[]> {
  if (!ENABLE_ADMIN) return [];

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) return [];

  const adminClient = getServiceSupabase();
  if (!adminClient) return [];

  const { data } = await adminClient
    .from('provider_invites')
    .select('id, email, token, service_id, created_at, accepted_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []) as ProviderInviteRow[];
}

export async function bulkInviteProviders(
  accessToken: string,
  csvText: string
): Promise<{
  ok: boolean;
  results: { line: string; ok: boolean; message: string; link?: string }[];
}> {
  if (!ENABLE_ADMIN) {
    return { ok: false, results: [{ line: '', ok: false, message: 'Admin er deaktivert.' }] };
  }

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) {
    return { ok: false, results: [{ line: '', ok: false, message: 'Ikke autorisert.' }] };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return {
      ok: false,
      results: [{ line: '', ok: false, message: 'Mangler Supabase-konfigurasjon.' }],
    };
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 50);

  const results: { line: string; ok: boolean; message: string; link?: string }[] = [];

  const { data: userData } = await adminClient.auth.getUser(accessToken);
  const createdBy = userData.user?.id ?? null;

  for (const line of lines) {
    const parts = line.split(',').map((part) => part.trim());
    const email = parts[0] ?? '';
    const serviceId = parts[1] ?? '';

    if (!email) {
      results.push({ line, ok: false, message: 'Manglende e-post.' });
      continue;
    }

    if (serviceId) {
      const { data: service } = await adminClient
        .from('services')
        .select('id')
        .eq('id', serviceId)
        .maybeSingle();
      if (!service) {
        results.push({ line, ok: false, message: 'Ugyldig service_id.' });
        continue;
      }
    }

    const created = await createInviteRecord(adminClient, {
      email: email.toLowerCase(),
      serviceId: serviceId || null,
      createdBy,
    });

    if (!created.ok || !created.invite) {
      results.push({ line, ok: false, message: created.message ?? 'Kunne ikke opprette invitasjon.' });
      continue;
    }

    const link = buildInviteLink(created.invite.token);

    if (ENABLE_EMAILS && isEmailConfigured) {
      const emailContent = providerInviteEmail({ inviteLink: link });
      const sendResult = await sendEmail({
        to: email.toLowerCase(),
        subject: emailContent.subject,
        body: emailContent.body,
      });
      if (!sendResult.ok) {
        results.push({
          line,
          ok: true,
          message: 'Invitasjon opprettet, men e-post feilet.',
          link,
        });
        continue;
      }
    }

    results.push({ line, ok: true, message: 'Invitasjon sendt.', link });
  }

  return { ok: true, results };
}

export async function exportServicesData(
  accessToken: string
): Promise<ExportResult<Record<string, unknown>[]>> {
  if (!ENABLE_ADMIN) {
    return { ok: false, message: 'Admin er deaktivert.', data: null };
  }

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) {
    return { ok: false, message: 'Ikke autorisert.', data: null };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.', data: null };
  }

  const { data, error } = await adminClient
    .from('services')
    .select('id, name, type, coverage, goals, price_level, rating_avg, rating_count, tags, is_active');

  if (error) {
    return { ok: false, message: 'Kunne ikke hente tjenester.', data: null };
  }

  return { ok: true, message: 'Eksport klar.', data: (data ?? []) as Record<string, unknown>[] };
}

export async function exportLeadsSummary(
  accessToken: string
): Promise<ExportResult<Record<string, unknown>[]>> {
  if (!ENABLE_ADMIN) {
    return { ok: false, message: 'Admin er deaktivert.', data: null };
  }

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) {
    return { ok: false, message: 'Ikke autorisert.', data: null };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.', data: null };
  }

  const { data, error } = await adminClient.from('leads').select('service_id, created_at');
  if (error) {
    return { ok: false, message: 'Kunne ikke hente leads.', data: null };
  }

  const now = Date.now();
  const since7 = now - 7 * 24 * 60 * 60 * 1000;
  const since30 = now - 30 * 24 * 60 * 60 * 1000;

  const summary = new Map<
    string,
    { service_id: string; total: number; last_7_days: number; last_30_days: number }
  >();

  (data ?? []).forEach((row) => {
    const serviceId = row.service_id as string;
    const createdAt = new Date(row.created_at as string).getTime();
    if (!summary.has(serviceId)) {
      summary.set(serviceId, {
        service_id: serviceId,
        total: 0,
        last_7_days: 0,
        last_30_days: 0,
      });
    }
    const current = summary.get(serviceId);
    if (!current) return;
    current.total += 1;
    if (createdAt >= since7) current.last_7_days += 1;
    if (createdAt >= since30) current.last_30_days += 1;
  });

  return { ok: true, message: 'Eksport klar.', data: Array.from(summary.values()) };
}

export async function exportEventSummary(
  accessToken: string
): Promise<ExportResult<Record<string, unknown>[]>> {
  if (!ENABLE_ADMIN) {
    return { ok: false, message: 'Admin er deaktivert.', data: null };
  }

  const adminOk = await isAdmin(accessToken);
  if (!adminOk) {
    return { ok: false, message: 'Ikke autorisert.', data: null };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.', data: null };
  }

  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const eventTypes = [
    'search_performed',
    'result_clicked',
    'profile_viewed',
    'lead_created',
    'partner_api_call',
  ];

  const results = await Promise.all(
    eventTypes.map(async (type) => {
      const last7 = await countEvents(adminClient, type, since7);
      const last30 = await countEvents(adminClient, type, since30);
      return { type, last_7_days: last7, last_30_days: last30 };
    })
  );

  return { ok: true, message: 'Eksport klar.', data: results };
}


