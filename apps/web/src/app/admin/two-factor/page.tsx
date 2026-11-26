'use client';

import { useEffect, useState } from 'react';
import { AdminShell, Panel, btn } from '@/components/admin/AdminShell';
import { ApiError, api } from '@/lib/api';

/** Two-factor sign-in for the signed-in team member, with any authenticator app. */
export default function TwoFactorPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const load = () => api.get<{ enabled: boolean }>('/auth/2fa').then((data) => setEnabled(data.enabled)).catch(() => setEnabled(false));
  useEffect(() => {
    void load();
  }, []);
  const fail = (caught: unknown) => setMessage({ tone: 'error', text: caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'That did not work.' });

  return (
    <AdminShell title="Two-factor sign-in">
      <Panel>
        <p className="text-sm text-ink-soft">With two-factor sign-in on, signing in to your account needs your password <strong>and</strong> a 6-digit code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password, Authy…). Strongly recommended for the owner and everyone with finance or staff access.</p>
        {message && <p className={`mt-3 text-sm ${message.tone === 'ok' ? 'text-safari-700' : 'text-danger'}`}>{message.text}</p>}
        {enabled === null ? (
          <p className="mt-4 text-sm text-ink-muted">Loading…</p>
        ) : enabled ? (
          <form
            className="mt-5 grid max-w-sm gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              try {
                await api.post('/auth/2fa/disable', { password: String(form.get('password')), code: String(form.get('code')) });
                setMessage({ tone: 'ok', text: 'Two-factor sign-in is off.' });
                await load();
              } catch (caught) {
                fail(caught);
              }
            }}
          >
            <p className="font-semibold text-safari-700">✓ Two-factor sign-in is on</p>
            <p className="text-xs text-ink-muted">To turn it off, confirm your password and a current code.</p>
            <input name="password" type="password" required className="field" placeholder="Password" autoComplete="current-password" />
            <input name="code" inputMode="numeric" required className="field" placeholder="6-digit code" autoComplete="one-time-code" />
            <button className={btn.danger}>Turn off</button>
          </form>
        ) : setup ? (
          <form
            className="mt-5 grid max-w-md gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              try {
                await api.post('/auth/2fa/enable', { code: String(form.get('code')) });
                setSetup(null);
                setMessage({ tone: 'ok', text: 'Two-factor sign-in is on. You will be asked for a code each time you sign in.' });
                await load();
              } catch (caught) {
                fail(caught);
              }
            }}
          >
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
              <li>In your authenticator app, add an account by entering this key (or tap the link on this phone):</li>
            </ol>
            <code className="break-all rounded-lg bg-sand p-3 font-mono text-sm tracking-wider">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            <a href={setup.otpauthUrl} className="text-sm font-semibold text-acacia-600 underline">Open in my authenticator app</a>
            <ol start={2} className="list-decimal space-y-1 pl-5 text-sm text-ink-soft"><li>Enter the 6-digit code the app shows:</li></ol>
            <input name="code" inputMode="numeric" required className="field" placeholder="123456" autoComplete="one-time-code" />
            <button className={btn.primary}>Turn on</button>
            <p className="text-xs text-ink-muted">Keep the key somewhere safe. If you lose your phone, the owner can reset your access from Staff & roles.</p>
          </form>
        ) : (
          <button
            className={`${btn.primary} mt-5`}
            onClick={async () => {
              try {
                setSetup(await api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', {}));
              } catch (caught) {
                fail(caught);
              }
            }}
          >
            Set up two-factor sign-in
          </button>
        )}
      </Panel>
    </AdminShell>
  );
}
