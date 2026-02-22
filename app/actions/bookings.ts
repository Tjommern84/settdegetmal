'use server';

import { createClient } from '@supabase/supabase-js';
import { BookingItem, BookingStatus, CancellationType, formatBookingTime } from '../../lib/booking';
import { sendEmail, isEmailConfigured } from '../../lib/emailClient';
import {
  bookingCancelledProviderEmail,
  bookingCancelledUserEmail,
  bookingConfirmedEmail,
} from '../../lib/emailTemplates';
import { logError } from '../../lib/errorLogger';
import { wrapServerAction } from '../../lib/actionWrapper';
import { getServiceSupabase } from '../../lib/serviceSupabase';
import { shouldSendEmail } from '../../lib/notificationPreferences';

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

const parseScheduledAt = (value: string): string | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

type QualityEventType = 'late_cancellation' | 'no_show';

const logQualityEvent = async (payload: {
  serviceId: string;
  bookingId: string;
  type: QualityEventType;
  userId: string | null;
}) => {
  const serviceClient = getServiceSupabase();
  if (!serviceClient) return;

  const { error } = await serviceClient.from('quality_events').insert({
    service_id: payload.serviceId,
    booking_id: payload.bookingId,
    type: payload.type,
    user_id: payload.userId,
  } as any);

  if (error) {
    await logError({
      level: 'warn',
      source: 'quality_event',
      context: 'log_quality_event',
      message: error.message ?? 'Kunne ikke logge kvalitetshendelse.',
      metadata: {
        serviceId: payload.serviceId,
        bookingId: payload.bookingId,
        type: payload.type,
      },
    });
  }
};

export async function getMyBookings(accessToken: string) {
  const supabase = getSupabase();
  if (!supabase || !accessToken) {
    return { customerBookings: [], providerBookings: [] };
  }

  const { data: userData } = await supabase.auth.getUser(accessToken);
  if (!userData || !userData.user) {
    return { customerBookings: [], providerBookings: [] };
  }

  const userId = userData.user.id;

  const { data: customerRows } = await supabase
    .from('bookings')
    .select(
      'id, lead_id, service_id, user_id, scheduled_at, status, confirmed_at, cancelled_at, created_at, cancelled_by, cancellation_type, no_show_marked, no_show_marked_at, service:services(id, name)'
    )
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: true });

  const { data: providerRows } = await supabase
    .from('bookings')
    .select(
      'id, lead_id, service_id, user_id, scheduled_at, status, confirmed_at, cancelled_at, created_at, cancelled_by, cancellation_type, no_show_marked, no_show_marked_at, service:services!inner(id, name, owner_user_id)'
    )
    .eq('service.owner_user_id', userId)
    .order('scheduled_at', { ascending: true });

  const normalize = (rows: typeof customerRows): BookingItem[] => {
    if (!Array.isArray(rows)) return [];
    return rows.map((row: any) => ({
      id: String(row.id ?? ''),
      lead_id: String(row.lead_id ?? ''),
      service_id: String(row.service_id ?? ''),
      service_name: row.service?.name ?? null,
      user_id: String(row.user_id ?? ''),
      scheduled_at: String(row.scheduled_at ?? ''),
      status: (row.status as BookingStatus) ?? 'proposed',
      confirmed_at: row.confirmed_at ?? null,
      cancelled_at: row.cancelled_at ?? null,
      cancelled_by: (row.cancelled_by as 'user' | 'provider') ?? null,
      cancellation_type: (row.cancellation_type as CancellationType) ?? null,
      no_show_marked: Boolean(row.no_show_marked),
      no_show_marked_at: row.no_show_marked_at ?? null,
      created_at: String(row.created_at ?? ''),
    }));
  };

  return {
    customerBookings: normalize(customerRows),
    providerBookings: normalize(providerRows),
  };
}

const sendBookingConfirmedEmail = async (
  userEmail: string,
  userId: string,
  serviceName: string,
  scheduledAt: string
) => {
  if (!isEmailConfigured) return;
  const shouldSend = await shouldSendEmail(userId, 'booking_confirmed');
  if (!shouldSend) return;
  const formattedTime = formatBookingTime(scheduledAt);
  const content = bookingConfirmedEmail({
    serviceName,
    scheduledAt: formattedTime,
  });
  await sendEmail({ to: userEmail, ...content });
};

const sendBookingCancelledEmail = async (
  recipientEmail: string,
  recipientId: string,
  serviceName: string,
  scheduledAt: string,
  context: 'provider' | 'user'
) => {
  if (!isEmailConfigured) return;
  const shouldSend = await shouldSendEmail(recipientId, 'booking_cancelled');
  if (!shouldSend) return;
  const formattedTime = formatBookingTime(scheduledAt);
  const content =
    context === 'provider'
      ? bookingCancelledProviderEmail({
          serviceName,
          scheduledAt: formattedTime,
        })
      : bookingCancelledUserEmail({
          serviceName,
          scheduledAt: formattedTime,
        });
  await sendEmail({ to: recipientEmail, ...content });
};

const createBookingHandler = async (
  _prevState: { ok: boolean; message: string },
  formData: FormData
): Promise<{ ok: boolean; message: string }> => {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const accessToken = String(formData.get('accessToken') ?? '');
  const leadId = String(formData.get('leadId') ?? '');
  const scheduledRaw = String(formData.get('scheduledAt') ?? '');

  if (!accessToken || !leadId || !scheduledRaw) {
    return { ok: false, message: 'Manglende data for booking.' };
  }

  const scheduledAt = parseScheduledAt(scheduledRaw);
  if (!scheduledAt) {
    return { ok: false, message: 'Ugyldig tidspunkt.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, service_id, user_id, email')
    .eq('id', leadId)
    .maybeSingle();
  if (leadError || !lead) {
    return { ok: false, message: 'Fant ikke forespørselen.' };
  }

  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('id, name, owner_user_id')
    .eq('id', lead.service_id)
    .maybeSingle();
  if (serviceError || !service) {
    return { ok: false, message: 'Fant ikke tjenesten.' };
  }

  if (service.owner_user_id !== userData.user.id) {
    return { ok: false, message: 'Du har ikke tilgang til denne tjenesten.' };
  }

  const { data: suggestion } = await supabase
    .from('lead_time_suggestions')
    .select('id')
    .eq('lead_id', leadId)
    .eq('suggested_at', scheduledAt)
    .maybeSingle();

  if (!suggestion) {
    return { ok: false, message: 'Tidspunktet er ikke foreslått.' };
  }

  const { error: insertError } = await supabase.from('bookings').insert({
    lead_id: leadId,
    service_id: service.id,
    user_id: lead.user_id,
    scheduled_at: scheduledAt,
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  });

  if (insertError) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'create_booking',
      message: insertError.message ?? 'Kunne ikke opprette booking.',
      metadata: { leadId, serviceId: service.id },
    });
    return { ok: false, message: 'Kunne ikke bekrefte booking.' };
  }

  if (lead.email) {
    await sendBookingConfirmedEmail(lead.email, lead.user_id, service.name ?? 'tjenesten', scheduledAt);
  }

  return { ok: true, message: 'Booking bekreftet.' };
};

const cancelBookingHandler = async (
  _prevState: { ok: boolean; message: string },
  formData: FormData
): Promise<{ ok: boolean; message: string }> => {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const accessToken = String(formData.get('accessToken') ?? '');
  const bookingId = String(formData.get('bookingId') ?? '');

  if (!accessToken || !bookingId) {
    return { ok: false, message: 'Manglende data for avlysning.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, lead_id, service_id, user_id, scheduled_at, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) {
    return { ok: false, message: 'Fant ikke booking.' };
  }

  if (booking.status === 'cancelled') {
    return { ok: false, message: 'Booking er allerede avlyst.' };
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('user_id, email')
    .eq('id', booking.lead_id)
    .maybeSingle();

  const { data: service } = await supabase
    .from('services')
    .select('id, owner_user_id, name, cancellation_hours')
    .eq('id', booking.service_id)
    .maybeSingle();

  if (!lead || !service) {
    return { ok: false, message: 'Relatert data mangler.' };
  }

  const isProvider = service.owner_user_id === userData.user.id;
  const isUser = lead.user_id === userData.user.id;

  if (!isProvider && !isUser) {
    return { ok: false, message: 'Du kan ikke avlyse denne bookingen.' };
  }

  const cancellationHours = Math.max(0, Number(service.cancellation_hours ?? 24));
  const scheduledDate = new Date(booking.scheduled_at);
  const now = new Date();
  const hoursUntil = (scheduledDate.getTime() - now.getTime()) / (60 * 60 * 1000);
  const isLate = hoursUntil < cancellationHours;
  const cancellationType = isLate ? 'late' : 'on_time';
  const cancelledBy = isProvider ? 'provider' : 'user';

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: now.toISOString(),
      cancellation_type: cancellationType,
      cancelled_by: cancelledBy,
    })
    .eq('id', bookingId);

  if (!updateError && isProvider && isLate && service.id && service.owner_user_id) {
    await logQualityEvent({
      serviceId: service.id,
      bookingId,
      type: 'late_cancellation',
      userId: service.owner_user_id,
    });
  }

  if (updateError) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'cancel_booking',
      message: updateError.message ?? 'Kunne ikke avlyse booking.',
      metadata: { bookingId },
    });
    return { ok: false, message: 'Kunne ikke avlyse bookingen.' };
  }

  const formattedTime = booking.scheduled_at;

  if (isProvider && lead.email) {
    await sendBookingCancelledEmail(
      lead.email,
      lead.user_id,
      service.name ?? 'tjenesten',
      formattedTime,
      'provider'
    );
  }

  if (isUser && service.owner_user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', service.owner_user_id)
      .maybeSingle();

    if (profile?.email) {
      await sendBookingCancelledEmail(
        profile.email,
        service.owner_user_id,
        service.name ?? 'tjenesten',
        formattedTime,
        'user'
      );
    }
  }

  return { ok: true, message: 'Booking avlyst.' };
};

const markNoShowHandler = async (
  _prevState: { ok: boolean; message: string },
  formData: FormData
): Promise<{ ok: boolean; message: string }> => {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Mangler Supabase-konfigurasjon.' };
  }

  const accessToken = String(formData.get('accessToken') ?? '');
  const bookingId = String(formData.get('bookingId') ?? '');

  if (!accessToken || !bookingId) {
    return { ok: false, message: 'Manglende data for no-show.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { ok: false, message: 'Innloggingen er ikke gyldig lenger.' };
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, service_id, scheduled_at, no_show_marked, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking) {
    return { ok: false, message: 'Fant ikke booking.' };
  }

  if (booking.status === 'cancelled') {
    return { ok: false, message: 'Booking er allerede avlyst.' };
  }

  if (booking.no_show_marked) {
    return { ok: false, message: 'No-show er allerede markert.' };
  }

  const { data: service } = await supabase
    .from('services')
    .select('id, owner_user_id, name')
    .eq('id', booking.service_id)
    .maybeSingle();

  if (!service || service.owner_user_id !== userData.user.id) {
    return { ok: false, message: 'Du kan ikke markere no-show for denne bookingen.' };
  }

  const scheduledDate = new Date(booking.scheduled_at);
  const now = new Date();
  if (now.getTime() < scheduledDate.getTime() + 2 * 60 * 60 * 1000) {
    return { ok: false, message: 'Du kan bare markere no-show minst 2 timer etter avtalt tid.' };
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      no_show_marked: true,
      no_show_marked_at: now.toISOString(),
    })
    .eq('id', bookingId);

  if (updateError) {
    await logError({
      level: 'error',
      source: 'server_action',
      context: 'mark_no_show',
      message: updateError.message ?? 'Kunne ikke markere no-show.',
      metadata: { bookingId },
    });
    return { ok: false, message: 'Kunne ikke markere no-show.' };
  }

  if (service.id && service.owner_user_id) {
    await logQualityEvent({
      serviceId: service.id,
      bookingId,
      type: 'no_show',
      userId: service.owner_user_id,
    });
  }

  return { ok: true, message: 'No-show markert.' };
};

export const createBookingFromSuggestion = wrapServerAction(
  'booking_create',
  createBookingHandler
);

export const cancelBooking = wrapServerAction('booking_cancel', cancelBookingHandler);

export const markBookingNoShow = wrapServerAction('booking_mark_no_show', markNoShowHandler);
