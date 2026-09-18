import type { OutgoingEmail } from './index';

/**
 * Email templates.
 *
 * Plain, table-free HTML with inline styles — the one layout approach that
 * renders predictably across Gmail, Outlook and phone mail apps. Every message
 * also carries a plain-text version, which some clients show instead and which
 * spam filters look for.
 */

const INK = '#0e1113';
const MUTED = '#6a7279';
const ACACIA = '#14543f';
const LINE = '#e6e1d7';

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f7f4ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <p style="margin:0 0 24px;font-size:15px;font-weight:700;letter-spacing:0.14em;color:${ACACIA};">ENHAKKORE</p>
    <div style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;padding:32px 28px;">
      ${bodyHtml}
    </div>
    <p style="margin:24px 4px 0;font-size:12px;line-height:1.6;color:${MUTED};">
      Enhakkore · Travel &amp; Impact<br>
      You received this because of activity on your Enhakkore account.
    </p>
  </div>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:28px 0;"><a href="${escape(href)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:10px;">${escape(label)}</a></p>`;
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function passwordResetEmail(input: {
  to: string;
  name: string;
  link: string;
  expiresInMinutes: number;
}): OutgoingEmail {
  const firstName = input.name.split(' ')[0] || 'there';
  const subject = 'Reset your Enhakkore password';

  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Choose a new password</h1>
     <p style="margin:0;font-size:15px;line-height:1.6;">Hi ${escape(firstName)}, we received a request to reset the password for your Enhakkore account.</p>
     ${button(input.link, 'Choose a new password')}
     <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${MUTED};">This link works once and expires in ${input.expiresInMinutes} minutes. Resetting signs you out on every other device.</p>
     <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${MUTED};"><strong style="color:${INK};">Didn't ask for this?</strong> Ignore this email — your password stays the same and nobody can change it without this link.</p>
     <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${MUTED};word-break:break-all;">If the button doesn't work, copy this address into your browser:<br>${escape(input.link)}</p>`,
  );

  const text = [
    `Hi ${firstName},`,
    '',
    'We received a request to reset the password for your Enhakkore account.',
    '',
    'Choose a new password:',
    input.link,
    '',
    `This link works once and expires in ${input.expiresInMinutes} minutes.`,
    'Resetting signs you out on every other device.',
    '',
    "Didn't ask for this? Ignore this email — your password stays the same.",
    '',
    '— Enhakkore · Travel & Impact',
  ].join('\n');

  return { to: input.to, subject, html, text };
}

/**
 * Sent after any password change. If the owner did not make the change, this
 * is how they find out — which is the point of sending it.
 */
export function passwordChangedEmail(input: { to: string; name: string; resetUrl: string }): OutgoingEmail {
  const firstName = input.name.split(' ')[0] || 'there';
  const subject = 'Your Enhakkore password was changed';

  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Your password was changed</h1>
     <p style="margin:0;font-size:15px;line-height:1.6;">Hi ${escape(firstName)}, the password for your Enhakkore account was just changed, and every other device was signed out.</p>
     <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${MUTED};"><strong style="color:${INK};">If this was you,</strong> there is nothing more to do.</p>
     <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:${MUTED};"><strong style="color:${INK};">If it wasn't,</strong> reset your password straight away and contact support@enhakkore.com.</p>
     ${button(input.resetUrl, 'Reset my password')}`,
  );

  const text = [
    `Hi ${firstName},`,
    '',
    'The password for your Enhakkore account was just changed, and every other device was signed out.',
    '',
    'If this was you, there is nothing more to do.',
    "If it wasn't, reset your password straight away and contact support@enhakkore.com:",
    input.resetUrl,
    '',
    '— Enhakkore · Travel & Impact',
  ].join('\n');

  return { to: input.to, subject, html, text };
}
