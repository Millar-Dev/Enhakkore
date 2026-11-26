'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OriginalLogo } from '@/components/site/BrandLogo';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { AuthResponse } from '@enhakkore/shared';

/**
 * One-time creation of the founder's Super Admin account. Not linked from
 * anywhere and not indexed. Works only with the SETUP_TOKEN set on the API,
 * only while no Super Admin exists, and closes for good once used.
 */
export default function SetupPage() {
  const router = useRouter();
  const { applyAuth } = useSession();
  const [open, setOpen] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ open: boolean }>('/auth/setup/status').then((data) => setOpen(data.open)).catch(() => setOpen(false));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-cream)] p-6">
      <meta name="robots" content="noindex, nofollow" />
      <div className="w-full max-w-md rounded-[1.4rem] border border-line bg-white p-6 shadow-sm md:p-8">
        <OriginalLogo src="/partners/enhakkore-wordmark.webp" height={72} />
        <h1 className="mt-6 font-display text-3xl text-acacia-700">Founder setup</h1>
        {open === null ? (
          <p className="mt-4 text-ink-muted">Checking…</p>
        ) : !open ? (
          <div className="mt-4 space-y-3 text-[0.9375rem] text-ink-soft">
            <p>Setup is closed. The Super Admin account already exists, or setup has not been enabled on the server.</p>
            <Link href="/admin/login" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Go to sign-in</Link>
          </div>
        ) : (
          <form
            className="mt-5 grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const password = String(form.get('password'));
              if (password !== String(form.get('confirm'))) {
                setFields({ confirm: 'The two passwords are different.' });
                return;
              }
              setBusy(true);
              setError(null);
              setFields({});
              try {
                const result = await api.post<AuthResponse>('/auth/setup', { token: String(form.get('token')), name: String(form.get('name')), email: String(form.get('email')), password }, { token: null });
                applyAuth(result);
                router.replace('/admin/two-factor?welcome=1');
              } catch (caught) {
                if (caught instanceof ApiError) {
                  setError(caught.message);
                  setFields(caught.fields);
                } else setError('Could not reach the server.');
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-ink-soft">Create the founder’s Super Admin account. You need the setup token that was added to the API’s settings on the hosting service. This page works once.</p>
            <F label="Setup token" name="token" type="password" error={fields.token} autoComplete="off" />
            <F label="Your full name" name="name" error={fields.name} autoComplete="name" />
            <F label="Email" name="email" type="email" error={fields.email} autoComplete="email" />
            <F label="Password (12+ characters, letters and numbers)" name="password" type="password" error={fields.password} autoComplete="new-password" />
            <F label="Repeat the password" name="confirm" type="password" error={fields.confirm} autoComplete="new-password" />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button disabled={busy} className="h-12 rounded-full bg-acacia-600 font-bold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create my Super Admin account'}</button>
            <p className="text-xs text-ink-muted">Next you will be asked to turn on two-factor sign-in. Afterwards, remove SETUP_TOKEN from the server settings — the setup is already closed either way.</p>
          </form>
        )}
      </div>
    </div>
  );
}

function F({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
      {label}
      <input className="field" required {...props} />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
