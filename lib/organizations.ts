'use server';

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { stripeB2B, stripeB2BConfig, isStripeB2BConfigured } from './stripeB2B';

export type Organization = {
  id: string;
  name: string;
  join_code: string;
  subscription_status: 'inactive' | 'active' | 'past_due';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
};

export type OrganizationRole = 'admin' | 'member';

export type OrganizationMembership = {
  organization: Organization;
  role: OrganizationRole;
};

export type OrgDashboard = {
  organization: Organization;
  membersCount: number;
  leadsCount: number;
  recentLeads: { id: string; service_id: string; service_name: string | null; created_at: string }[];
};

const getSupabaseWithToken = (accessToken: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
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

const getUserFromToken = async (accessToken: string) => {
  const supabase = getSupabaseWithToken(accessToken);
  if (!supabase || !accessToken) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
};

const generateJoinCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const mapOrganization = (row: Record<string, unknown>): Organization => ({
  id: row.id as string,
  name: row.name as string,
  join_code: row.join_code as string,
  subscription_status: (row.subscription_status as Organization['subscription_status']) ?? 'inactive',
  stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
  stripe_subscription_id: (row.stripe_subscription_id as string | null) ?? null,
  created_at: row.created_at as string,
});

export async function createOrganization(
  accessToken: string,
  name: string
): Promise<{ ok: boolean; message: string; organization?: Organization }> {
  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const user = await getUserFromToken(accessToken);
  if (!user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const cleanName = name.trim();
  if (!cleanName) {
    return { ok: false, message: 'Navn mangler.' };
  }

  const supabase = getSupabaseWithToken(accessToken);
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  let organization: Organization | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from('organizations')
      .insert({ name: cleanName, join_code: joinCode })
      .select(
        'id, name, join_code, subscription_status, stripe_customer_id, stripe_subscription_id, created_at'
      )
      .single();

    if (!error && data) {
      organization = mapOrganization(data as Record<string, unknown>);
      break;
    }

    if (error?.code === '23505') {
      continue;
    }

    lastError = error?.message ?? 'Kunne ikke opprette bedriften.';
    break;
  }

  if (!organization) {
    return { ok: false, message: lastError ?? 'Kunne ikke opprette bedriften.' };
  }

  const { error: memberError } = await supabase.from('organization_members').insert({
    organization_id: organization.id,
    user_id: user.id,
    role: 'admin',
  });

  if (memberError) {
    return { ok: false, message: 'Kunne ikke legge deg til i bedriften.' };
  }

  return { ok: true, message: 'Bedrift opprettet.', organization };
}

export async function joinOrganization(
  accessToken: string,
  code: string
): Promise<{ ok: boolean; message: string; organization?: Organization }> {
  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const user = await getUserFromToken(accessToken);
  if (!user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { ok: false, message: 'Kode mangler.' };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: orgRow } = await adminClient
    .from('organizations')
    .select(
      'id, name, join_code, subscription_status, stripe_customer_id, stripe_subscription_id, created_at'
    )
    .eq('join_code', cleanCode)
    .maybeSingle();

  if (!orgRow) {
    return { ok: false, message: 'Fant ingen bedrift med denne koden.' };
  }

  const organization = mapOrganization(orgRow as Record<string, unknown>);

  const { data: existing } = await adminClient
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', organization.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    await adminClient.from('organization_members').insert({
      organization_id: organization.id,
      user_id: user.id,
      role: 'member',
    });
  }

  return { ok: true, message: 'Du er nå med i bedriften.', organization };
}

export async function getMyOrganization(
  accessToken: string
): Promise<{ ok: boolean; membership?: OrganizationMembership; message?: string }> {
  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const user = await getUserFromToken(accessToken);
  if (!user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: membership } = await adminClient
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .maybeSingle();

  if (!membership) {
    return { ok: true };
  }

  const { data: orgRow } = await adminClient
    .from('organizations')
    .select(
      'id, name, join_code, subscription_status, stripe_customer_id, stripe_subscription_id, created_at'
    )
    .eq('id', membership.organization_id)
    .maybeSingle();

  if (!orgRow) {
    return { ok: true };
  }

  return {
    ok: true,
    membership: {
      organization: mapOrganization(orgRow as Record<string, unknown>),
      role: (membership.role as OrganizationRole) ?? 'member',
    },
  };
}

export async function recordOrgLead(leadId: string): Promise<void> {
  if (!leadId) return;

  const adminClient = getServiceSupabase();
  if (!adminClient) return;

  const { data: lead } = await adminClient
    .from('leads')
    .select('id, user_id')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead?.user_id) return;

  const { data: membership } = await adminClient
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', lead.user_id)
    .order('created_at', { ascending: true })
    .maybeSingle();

  if (!membership?.organization_id) return;

  const { error } = await adminClient.from('organization_lead_stats').insert({
    organization_id: membership.organization_id,
    lead_id: lead.id,
  });

  if (error?.code === '23505') {
    return;
  }
}

export async function getOrgSubscriptionStatusForUser(
  userId: string
): Promise<Organization['subscription_status'] | null> {
  if (!userId) return null;

  const adminClient = getServiceSupabase();
  if (!adminClient) return null;

  const { data: membership } = await adminClient
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .maybeSingle();

  if (!membership?.organization_id) return null;

  const { data: orgRow } = await adminClient
    .from('organizations')
    .select('subscription_status')
    .eq('id', membership.organization_id)
    .maybeSingle();

  return (orgRow?.subscription_status as Organization['subscription_status']) ?? null;
}

export async function createOrgCheckoutSession(
  accessToken: string,
  organizationId: string
): Promise<{ ok: boolean; message: string; url?: string }> {
  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  if (!isStripeB2BConfigured || !stripeB2B || !stripeB2BConfig.priceId) {
    return { ok: false, message: 'Stripe er ikke konfigurert for bedrifter.' };
  }

  const user = await getUserFromToken(accessToken);
  if (!user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: membership } = await adminClient
    .from('organization_members')
    .select('organization_id, role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'admin') {
    return { ok: false, message: 'Du har ikke tilgang til dette abonnementet.' };
  }

  const { data: organization } = await adminClient
    .from('organizations')
    .select('id, name, stripe_customer_id')
    .eq('id', organizationId)
    .maybeSingle();

  if (!organization) {
    return { ok: false, message: 'Fant ikke bedriften.' };
  }

  const session = await stripeB2B.checkout.sessions.create({
    mode: 'subscription',
    customer: organization.stripe_customer_id ?? undefined,
    line_items: [{ price: stripeB2BConfig.priceId, quantity: 1 }],
    success_url: `${stripeB2BConfig.appUrl}/org-dashboard?status=success`,
    cancel_url: `${stripeB2BConfig.appUrl}/org-dashboard?status=cancel`,
    metadata: {
      organization_id: organization.id as string,
    },
  });

  if (!session.url) {
    return { ok: false, message: 'Kunne ikke starte betaling.' };
  }

  return { ok: true, message: 'OK', url: session.url };
}

export async function getOrgDashboard(
  accessToken: string
): Promise<{ ok: boolean; message: string; data?: OrgDashboard }> {
  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  const user = await getUserFromToken(accessToken);
  if (!user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const adminClient = getServiceSupabase();
  if (!adminClient) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const { data: membership } = await adminClient
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'admin') {
    return { ok: false, message: 'Du har ikke tilgang til bedriftens oversikt.' };
  }

  const { data: orgRow } = await adminClient
    .from('organizations')
    .select(
      'id, name, join_code, subscription_status, stripe_customer_id, stripe_subscription_id, created_at'
    )
    .eq('id', membership.organization_id)
    .maybeSingle();

  if (!orgRow) {
    return { ok: false, message: 'Fant ikke bedriften.' };
  }

  const organization = mapOrganization(orgRow as Record<string, unknown>);

  const { count: membersCount } = await adminClient
    .from('organization_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('organization_id', organization.id);

  const { count: leadsCount } = await adminClient
    .from('organization_lead_stats')
    .select('lead_id', { count: 'exact', head: true })
    .eq('organization_id', organization.id);

  const { data: recentStats } = await adminClient
    .from('organization_lead_stats')
    .select('lead_id, created_at')
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const leadIds = (recentStats ?? []).map((row) => row.lead_id as string);
  const leadMap = new Map<string, { service_id: string; created_at: string }>();

  if (leadIds.length > 0) {
    const { data: leads } = await adminClient
      .from('leads')
      .select('id, service_id, created_at')
      .in('id', leadIds);

    (leads ?? []).forEach((row) => {
      leadMap.set(row.id as string, {
        service_id: row.service_id as string,
        created_at: row.created_at as string,
      });
    });
  }

  const serviceIds = Array.from(
    new Set(Array.from(leadMap.values()).map((lead) => lead.service_id))
  );
  const serviceNameMap = new Map<string, string>();

  if (serviceIds.length > 0) {
    const { data: services } = await adminClient
      .from('services')
      .select('id, name')
      .in('id', serviceIds);

    (services ?? []).forEach((row) => {
      serviceNameMap.set(row.id as string, row.name as string);
    });
  }

  const recentLeads = (recentStats ?? []).map((row) => {
    const leadInfo = leadMap.get(row.lead_id as string);
    return {
      id: row.lead_id as string,
      service_id: leadInfo?.service_id ?? 'ukjent',
      service_name: leadInfo?.service_id ? serviceNameMap.get(leadInfo.service_id) ?? null : null,
      created_at: (leadInfo?.created_at as string) ?? (row.created_at as string),
    };
  });

  return {
    ok: true,
    message: 'OK',
    data: {
      organization,
      membersCount: membersCount ?? 0,
      leadsCount: leadsCount ?? 0,
      recentLeads,
    },
  };
}

