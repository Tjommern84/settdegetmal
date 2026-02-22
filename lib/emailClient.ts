import { Resend } from 'resend';
import { logError } from './errorLogger';

const resendKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL;

export const isEmailConfigured = Boolean(resendKey && resendFrom);

const getResend = () => {
  if (!resendKey) return null;
  return new Resend(resendKey);
};

export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (!resendKey || !resendFrom) {
    return { ok: false, message: 'Mangler e-postkonfigurasjon.' };
  }

  const client = getResend();
  if (!client) {
    return { ok: false, message: 'E-postklient er ikke tilgjengelig.' };
  }

  try {
    const { error } = await client.emails.send({
      from: resendFrom,
      to: params.to,
      subject: params.subject,
      text: params.body,
    });

    if (error) {
      await logError({
        level: 'error',
        source: 'route',
        context: 'email_send',
        message: error.message ?? 'Kunne ikke sende e-post.',
        metadata: { to: params.to, subject: params.subject },
      });
      return { ok: false, message: 'Kunne ikke sende e-post.' };
    }

    return { ok: true };
  } catch (error) {
    await logError({
      level: 'error',
      source: 'route',
      context: 'email_send',
      message: error instanceof Error ? error.message : 'Ukjent feil ved sending.',
      stack: error instanceof Error ? error.stack : null,
      metadata: { to: params.to, subject: params.subject },
    });
    return { ok: false, message: 'Kunne ikke sende e-post.' };
  }
}
