'use server';

import { createClient } from '@supabase/supabase-js';
import { sendEmail, isEmailConfigured } from '../../../../lib/emailClient';
import { providerRepliedEmail } from '../../../../lib/emailTemplates';
import { shouldSendEmail } from '../../../../lib/notificationPreferences';
import { logError } from '../../../../lib/errorLogger';
import { wrapServerAction } from '../../../../lib/actionWrapper';
import { CancellationType } from '../../../../lib/booking';
import { ENABLE_EMAILS, ENABLE_PAYMENTS } from '../../../../lib/featureFlags';
import { isStripeConfigured } from '../../../../lib/stripe';

type LeadRow = {
  id: string;
  service_id: string;
  user_id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

type LeadMessageRow = {
  id: string;
  lead_id: string;
  sender_role: 'provider' | 'user';
  message: string;
  created_at: string;
};

type LeadSuggestionRow = {
  id: string;
  suggested_at: string;
};

type LeadBooking = {
  id: string;
  scheduled_at: string;
  status: 'proposed' | 'confirmed' | 'cancelled';
  cancellation_type: CancellationType | null;
  cancelled_by: 'user' | 'provider' | null;
  no_show_marked: boolean;
  no_show_marked_at: string | null;
} | null;

const getSupabase = (): any => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

const hasEmailEvent = async (
  supabase: any,
  leadId: string,
  recipientEmail: string
) => {
  const { data } = await supabase
    .from('email_events')
    .select('id')
    .eq('type', 'provider_replied')
    .eq('lead_id', leadId)
    .eq('recipient_email', recipientEmail)
    .maybeSingle();

  return Boolean(data?.id);
};

const logEmailEvent = async (
  supabase: any,
  leadId: string,
  recipientEmail: string
) => {
  await supabase.from('email_events').insert({
    type: 'provider_replied',
    lead_id: leadId,
    recipient_email: recipientEmail,
  });
};

const getProfileById = async (supabase: ReturnType<typeof createClient>, userId: string) => {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle();

  return data as { id: string; full_name?: string } | null;
};

export async function getLeadWithMessages(
  leadId: string,
  accessToken: string
): Promise<{
  lead: LeadRow | null;
  messages: LeadMessageRow[];
  suggestions: LeadSuggestionRow[];
  booking: LeadBooking;
  role: 'provider' | 'user' | 'none';
}> {
  const supabase = getSupabase();
  if (!supabase || !leadId || !accessToken) {
    return { lead: null, messages: [], suggestions: [], booking: null, role: 'none' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { lead: null, messages: [], suggestions: [], booking: null, role: 'none' };
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('id, service_id, user_id, name, email, message, created_at')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead) {
    return { lead: null, messages: [], suggestions: [], booking: null, role: 'none' };
  }

  const { data: service } = await supabase
    .from('services')
    .select('owner_user_id')
    .eq('id', lead.service_id)
    .maybeSingle();

  const isProvider = service?.owner_user_id === userData.user.id;
  const isUser = lead.user_id === userData.user.id;

  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id, scheduled_at, status, cancellation_type, cancelled_by, no_show_marked, no_show_marked_at'
    )
    .eq('lead_id', leadId)
    .maybeSingle();

  if (!isProvider && !isUser) {
    return { lead: null, messages: [], suggestions: [], booking: null, role: 'none' };
  }

  const { data: messages } = await supabase
    .from('lead_messages')
    .select('id, lead_id, sender_role, message, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  const { data: suggestions } = await supabase
    .from('lead_time_suggestions')
    .select('id, suggested_at')
    .eq('lead_id', leadId)
    .order('suggested_at', { ascending: true });

  return {
    lead,
    messages: messages ?? [],
    suggestions: suggestions ?? [],
    booking: booking
      ? {
          id: String(booking.id ?? ''),
          scheduled_at: String(booking.scheduled_at ?? ''),
          status: booking.status as 'proposed' | 'confirmed' | 'cancelled',
          cancellation_type: (booking.cancellation_type as CancellationType) ?? null,
          cancelled_by:
            booking.cancelled_by === 'provider' || booking.cancelled_by === 'user'
              ? (booking.cancelled_by as 'provider' | 'user')
              : null,
          no_show_marked: Boolean(booking.no_show_marked),
          no_show_marked_at: booking.no_show_marked_at
            ? String(booking.no_show_marked_at)
            : null,
        }
      : null,
    role: isProvider ? 'provider' : 'user',
  };
}

const sendProviderMessageHandler = async (
  _prevState: { ok: boolean; message: string },
  formData: FormData
): Promise<{ ok: boolean; message: string }> => {
  if (!ENABLE_PAYMENTS || !isStripeConfigured) {
    return { ok: false, message: 'Betaling er ikke aktivert ennå.' };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const accessToken = String(formData.get('accessToken') ?? '');
  const leadId = String(formData.get('leadId') ?? '');
  const message = String(formData.get('message') ?? '').trim();

  if (!accessToken) {
    return { ok: false, message: 'Du må være innlogget.' };
  }

  if (!leadId || !message) {
    return { ok: false, message: 'Meldingen kan ikke være tom.' };
  }

  if (message.length < 10) {
    return { ok: false, message: 'Meldingen må være minst 10 tegn.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('id, service_id, email, user_id')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, message: 'Fant ikke forespørselen.' };
  }

  const { data: service } = await supabase
    .from('services')
    .select('name, owner_user_id, subscription_status')
    .eq('id', lead.service_id)
    .maybeSingle();

  if (!service || service.owner_user_id !== userData.user.id) {
    return { ok: false, message: 'Du kan ikke svare på denne forespørselen.' };
  }

  if (service.subscription_status !== 'active') {
    return { ok: false, message: 'Abonnementet er ikke aktivt.' };
  }

  const { error: insertError } = await supabase.from('lead_messages').insert({
    lead_id: leadId,
    sender_role: 'provider',
    message,
  });

  if (insertError) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'provider_message_send',
      message: insertError.message ?? 'Kunne ikke lagre svaret.',
      metadata: { leadId },
    });
    return { ok: false, message: 'Kunne ikke lagre svaret.' };
  }

  if (ENABLE_EMAILS && isEmailConfigured && lead.email) {
    const alreadySent = await hasEmailEvent(supabase, leadId, lead.email);
    if (!alreadySent) {
      const allowed = await shouldSendEmail(lead.user_id, 'provider_replied');
      if (allowed) {
        const profile = await getProfileById(supabase, userData.user.id);
        const providerName = profile?.full_name ?? service.name ?? 'Tilbyder';
        const emailContent = providerRepliedEmail({
          serviceName: service.name ?? 'tjenesten',
          providerName,
          message,
        });
        const sendResult = await sendEmail({
          to: lead.email,
          subject: emailContent.subject,
          body: emailContent.body,
        });
        if (sendResult.ok) {
          await logEmailEvent(supabase, leadId, lead.email);
        }
      }
    }
  }

  return { ok: true, message: 'Svar sendt.' };
};

export const sendProviderMessage = wrapServerAction('provider_message_send', sendProviderMessageHandler);

