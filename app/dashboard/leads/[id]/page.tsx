'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabaseClient';
import {
  createBookingFromSuggestion,
  cancelBooking,
  markBookingNoShow,
} from '../../../actions/bookings';
import {
  bookingStatusLabel,
  cancellationTypeLabel,
  CancellationType,
  formatBookingTime,
} from '../../../../lib/booking';
import { getLeadWithMessages, sendProviderMessage } from './actions';
import { Button, ButtonLink, type ButtonVariant } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { Textarea } from '../../../../components/ui/Input';
import { container, label } from '../../../../lib/ui';
import { ENABLE_PAYMENTS, ENABLE_PILOT_MODE } from '../../../../lib/featureFlags';

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

type LeadSuggestion = {
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
};

type LeadPayload = {
  lead: LeadRow | null;
  messages: LeadMessageRow[];
  suggestions: LeadSuggestion[];
  booking: LeadBooking | null;
  role: 'provider' | 'user' | 'none';
};

const formatSuggestionTime = (value: string) =>
  new Date(value).toLocaleString('no-NO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

const NO_SHOW_GRACE_MS = 2 * 60 * 60 * 1000;

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const [leadPayload, setLeadPayload] = useState<LeadPayload>({
    lead: null,
    messages: [],
    suggestions: [],
    booking: null,
    role: 'none',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [messageInput, setMessageInput] = useState('');

  const [sendState, sendAction] = useFormState(sendProviderMessage, {
    ok: false,
    message: '',
  });
  const [bookingState, bookingAction] = useFormState(createBookingFromSuggestion, {
    ok: false,
    message: '',
  });
  const [cancelBookingState, cancelBookingAction] = useFormState(cancelBooking, {
    ok: false,
    message: '',
  });
  const [noShowState, noShowAction] = useFormState(markBookingNoShow, {
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
    if (!session?.access_token) return;

    const loadLead = async () => {
      setStatus('loading');
      const payload = await getLeadWithMessages(params.id, session.access_token);
      if (!payload.lead) {
        setStatus('error');
        return;
      }
      setLeadPayload(payload);
      setStatus('idle');
    };

    loadLead();
  }, [
    params.id,
    session?.access_token,
    sendState.ok,
    bookingState.ok,
    cancelBookingState.ok,
    noShowState.ok,
  ]);

  const canMarkNoShow = useMemo(() => {
    if (leadPayload.role !== 'provider' || !leadPayload.booking) return false;
    if (leadPayload.booking.status === 'cancelled') return false;
    if (leadPayload.booking.no_show_marked) return false;
    const scheduled = new Date(leadPayload.booking.scheduled_at).getTime();
    return Date.now() > scheduled + NO_SHOW_GRACE_MS;
  }, [leadPayload]);

  const formatNoShowTime = (value: string | null) => {
    if (!value) return '';
    return new Date(value).toLocaleString('no-NO', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  if (!isSupabaseConfigured) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Forespørsel</h1>
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
          <h1 className="text-2xl font-semibold text-slate-900">Forespørsel</h1>
          <p className="mt-3 text-sm text-slate-600">
            Logg inn for å se forespørselen.
          </p>
          <ButtonLink href="/dashboard" className="mt-6">
            Tilbake til dashboard
          </ButtonLink>
        </Card>
      </main>
    );
  }

  if (status === 'error' || !leadPayload.lead) {
    return (
      <main className={`${container} py-16`}>
        <Card>
          <h1 className="text-2xl font-semibold text-slate-900">Forespørsel</h1>
          <p className="mt-3 text-sm text-slate-600">
            Du har ikke tilgang til denne forespørselen.
          </p>
          <ButtonLink href="/dashboard" className="mt-6">
            Tilbake til dashboard
          </ButtonLink>
        </Card>
      </main>
    );
  }

  const lead = leadPayload.lead;

  return (
    <main className={`${container} py-12`}>
      <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-700">
        Tilbake til dashboard
      </Link>

      {ENABLE_PILOT_MODE && leadPayload.role === 'provider' && (
        <Card className="mt-6 border-amber-200 bg-amber-50 text-sm text-amber-700">
          Pilot - funksjoner kan endres.
        </Card>
      )}

      <Card className="mt-6 p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{lead.name}</h1>
            <p className="text-sm text-slate-500">{lead.email}</p>
          </div>
          <div className="text-xs text-slate-500">
            {new Date(lead.created_at).toLocaleString('no-NO')}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Brukerens forespørsel
          </p>
          <p className="mt-2">{lead.message}</p>
        </div>

        {!leadPayload.booking && leadPayload.suggestions.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Foreslåtte tider
            </p>
            {bookingState.message && (
              <div
                className={`mt-3 rounded-lg px-4 py-3 text-sm ${
                  bookingState.ok
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {bookingState.message}
              </div>
            )}
            <ul className="mt-4 space-y-3">
              {leadPayload.suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{formatSuggestionTime(suggestion.suggested_at)}</span>
                  <form className="mt-2 sm:mt-0" action={bookingAction}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="accessToken" value={session?.access_token ?? ''} />
                    <input type="hidden" name="scheduledAt" value={suggestion.suggested_at} />
                    <SubmitButton
                      disabled={!session || !ENABLE_PAYMENTS}
                      pendingText="Bekrefter ..."
                    >
                      Bekreft denne tiden
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}

        {leadPayload.booking && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bookingstatus
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Status: {bookingStatusLabel[leadPayload.booking.status]}
            </p>
            <p className="text-sm text-slate-700">
              Tidspunkt: {formatBookingTime(leadPayload.booking.scheduled_at)}
            </p>
            {leadPayload.booking.cancellation_type && (
              <p className="mt-2 text-xs font-semibold text-rose-600">
                {cancellationTypeLabel[leadPayload.booking.cancellation_type]}
              </p>
            )}
            {leadPayload.booking.cancelled_by && leadPayload.booking.status === 'cancelled' && (
              <p className="text-xs text-slate-500">
                Avbestilt av {leadPayload.booking.cancelled_by === 'provider' ? 'tilbyder' : 'bruker'}
              </p>
            )}
            {leadPayload.booking.no_show_marked && (
              <p className="text-xs text-slate-500">
                No-show markert {formatNoShowTime(leadPayload.booking.no_show_marked_at)}
              </p>
            )}
            {cancelBookingState.message && (
              <div
                className={`mt-3 rounded-lg px-4 py-3 text-sm ${
                  cancelBookingState.ok
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {cancelBookingState.message}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <form className="flex-1 min-w-[200px]" action={cancelBookingAction}>
                <input type="hidden" name="bookingId" value={leadPayload.booking.id} />
                <input type="hidden" name="accessToken" value={session?.access_token ?? ''} />
                <SubmitButton
                  variant="destructive"
                  disabled={!session || leadPayload.booking.status === 'cancelled'}
                  pendingText="Avlyser ..."
                >
                  Avlys booking
                </SubmitButton>
              </form>
              {leadPayload.role === 'provider' && (
                <form className="flex-1 min-w-[200px]" action={noShowAction}>
                  <input type="hidden" name="bookingId" value={leadPayload.booking.id} />
                  <input type="hidden" name="accessToken" value={session?.access_token ?? ''} />
                  <SubmitButton
                    variant="secondary"
                    disabled={!canMarkNoShow}
                    pendingText="Markerer ..."
                  >
                    Marker som no-show
                  </SubmitButton>
                </form>
              )}
            </div>
            {noShowState.message && (
              <p
                className={`mt-2 text-xs ${
                  noShowState.ok ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {noShowState.message}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="mt-8 p-8">
        <h2 className="text-lg font-semibold text-slate-900">Meldinger</h2>
        <div className="mt-4 grid gap-4">
          {leadPayload.messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                message.sender_role === 'provider'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{message.sender_role === 'provider' ? 'Tilbyder' : 'Bruker'}</span>
                <span>{new Date(message.created_at).toLocaleString('no-NO')}</span>
              </div>
              <p className="mt-2">{message.message}</p>
            </div>
          ))}
          {leadPayload.messages.length === 0 && (
            <div className="text-sm text-slate-600">Ingen svar enda.</div>
          )}
        </div>

        {leadPayload.role === 'provider' && (
          <form className="mt-6 grid gap-3" action={sendAction}>
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="accessToken" value={session.access_token} />
            {!ENABLE_PAYMENTS && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Svar er midlertidig stengt mens vi klargjør betaling.
              </div>
            )}
            <div className="grid gap-2">
              <label htmlFor="message" className={label}>
                Svar til kunden
              </label>
              <Textarea
                id="message"
                name="message"
                rows={4}
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
              />
            </div>
            {sendState.message && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  sendState.ok
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {sendState.message}
              </div>
            )}
            <Button type="submit" disabled={!messageInput.trim() || !ENABLE_PAYMENTS}>
              Send svar
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
