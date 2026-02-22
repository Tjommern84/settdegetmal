'use client';

import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { usePathname } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { submitFeedback } from '../app/feedback/actions';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { Button } from './ui/Button';
import { Textarea } from './ui/Input';
import { Card } from './ui/Card';
import { label } from '../lib/ui';

type FeedbackModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState('');
  const [state, action] = useFormState(submitFeedback, { ok: false, message: '' });

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
    if (!state.ok) return;
    setMessage('');
  }, [state.ok]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <Card className="w-full max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Gi feedback</h2>
            <p className="mt-1 text-sm text-slate-600">
              Fortell hva som fungerer og hva vi bør forbedre.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            aria-label="Lukk"
          >
            Lukk
          </button>
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Feedback er midlertidig utilgjengelig.
          </div>
        )}

        <form className="mt-4 grid gap-3" action={action}>
          <input type="hidden" name="page" value={pathname || ''} />
          <input type="hidden" name="accessToken" value={session?.access_token ?? ''} />
          <div className="grid gap-2">
            <label htmlFor="feedback-message" className={label}>
              Melding
            </label>
            <Textarea
              id="feedback-message"
              name="message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </div>
          {state.message && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                state.ok
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {state.message}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!isSupabaseConfigured}>
              Send feedback
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
