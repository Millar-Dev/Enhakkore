import { env } from '../../env';

/**
 * Outgoing email.
 *
 * One seam, two adapters — the same shape as payments:
 *
 * - `console` (no RESEND_API_KEY): nothing is sent. In development the whole
 *   message, links included, is printed to the API log so flows can be tested
 *   end to end. In production the log names the recipient and subject only —
 *   printing a password-reset link into hosting logs would hand account access
 *   to anyone who can read them.
 * - `resend`: sends through the Resend HTTP API. No SDK dependency; one fetch.
 *
 * Sending never throws to callers. Email is a side effect: a failed send is
 * logged, and the request that triggered it still succeeds.
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  delivered: boolean;
  provider: 'console' | 'resend';
  id?: string;
  error?: string;
}

async function sendViaConsole(message: OutgoingEmail): Promise<EmailResult> {
  if (env.isProduction) {
    console.warn(
      `[email] not sent — no email provider configured. to=${message.to} subject="${message.subject}"`,
    );
  } else {
    console.log(
      [
        '',
        '┌─ [email · console adapter · not actually sent] ─────────────',
        `│ to:      ${message.to}`,
        `│ subject: ${message.subject}`,
        '│',
        ...message.text.split('\n').map((line) => `│ ${line}`),
        '└─────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
  }
  return { delivered: false, provider: 'console' };
}

async function sendViaResend(message: OutgoingEmail): Promise<EmailResult> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.email.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };

    if (!response.ok) {
      // The common one before a domain is verified: Resend's shared test sender
      // only delivers to the account owner's own address (403).
      console.error(
        `[email] Resend rejected the message (${response.status} ${body.name ?? ''}): ${body.message ?? 'no detail'} — to=${message.to}`,
      );
      return { delivered: false, provider: 'resend', error: body.message ?? `HTTP ${response.status}` };
    }

    return { delivered: true, provider: 'resend', id: body.id };
  } catch (error) {
    console.error('[email] could not reach Resend:', error instanceof Error ? error.message : error);
    return { delivered: false, provider: 'resend', error: 'network' };
  }
}

export async function sendEmail(message: OutgoingEmail): Promise<EmailResult> {
  return env.email.provider === 'resend' ? sendViaResend(message) : sendViaConsole(message);
}
