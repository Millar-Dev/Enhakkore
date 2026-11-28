'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OriginalLogo } from '@/components/site/BrandLogo';
import { ApiError, api } from '@/lib/api';

/**
 * Super Admin access recovery (forgotten password or lost authenticator) for
 * when email is not connected. Works only while OWNER_RECOVERY_TOKEN is set on
 * the API — proof that you control the hosting. Not linked from the public site.
 */
export default function RecoverPage() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get<{ open: boolean }>('/auth/recover-owner/status', { token: null }).then((data) => setOpen(data.open)).catch(() => setOpen(false));
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-cream)] p-6">
      <meta name="robots" content="noindex, nofollow" />
      <div className="w-full max-w-md rounded-[1.4rem] border border-line bg-white p-6 shadow-sm md:p-8">
        <OriginalLogo src="/partners/enhakkore-wordmark.webp" height={72} />
        <h1 className="mt-6 font-display text-3xl text-acacia-700">Recover Super Admin access</h1>
        {open === null ? <p className="mt-4 text-ink-muted">Checking…</p> : done ? (
          <div className="mt-4 space-y-3 text-[0.9375rem] text-ink-soft">
            <p>Your password was reset and every session was signed out. Remove OWNER_RECOVERY_TOKEN from the API settings on Render now.</p>
            <Link href="/admin/login" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Sign in</Link>
          </div>
        ) : !open ? (
          <div className="mt-4 space-y-3 text-[0.9375rem] text-ink-soft [overflow-wrap:anywhere]">
            <p>Recovery is not switched on. To use it, add <strong>OWNER_RECOVERY_TOKEN</strong> (a random secret of 24+ characters) to the API service’s environment on Render, wait for it to redeploy, then reload this page.</p>
            <p>If email is connected, use <Link href="/forgot-password" className="font-semibold underline">Forgot password</Link> instead.</p>
          </div>
        ) : (
          <form
            className="mt-5 grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (String(form.get('password')) !== String(form.get('confirm'))) {
                setError('The two passwords are different.');
                return;
              }
              setBusy(true);
              setError(null);
              try {
                await api.post('/auth/recover-owner', { token: String(form.get('token')), email: String(form.get('email')), password: String(form.get('password')), resetTwoFactor: form.get('reset2fa') === 'on' }, { token: null });
                setDone(true);
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.');
                setBusy(false);
              }
            }}
          >
            <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">Recovery token<input name="token" type="password" required autoComplete="off" className="field" /></label>
            <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">Super Admin email<input name="email" type="email" required autoComplete="email" className="field" /></label>
            <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">New password (12+ characters, letters and numbers)<input name="password" type="password" required minLength={12} autoComplete="new-password" className="field" /></label>
            <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">Repeat the new password<input name="confirm" type="password" required minLength={12} autoComplete="new-password" className="field" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reset2fa" /> I lost my authenticator — switch two-factor off so I can set it up again</label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button disabled={busy} className="h-12 rounded-full bg-acacia-600 font-bold text-white disabled:opacity-50">{busy ? 'Resetting…' : 'Reset my access'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
