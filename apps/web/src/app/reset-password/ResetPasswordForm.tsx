'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AuthResponse } from '@enhakkore/shared';
import { Alert, Button, ButtonLink, Icon, Skeleton } from '@/components/ui';
import { Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { homeFor, useSession } from '@/lib/session';

type LinkState =
  | { kind: 'checking' }
  | { kind: 'valid' }
  | { kind: 'invalid'; reason: 'invalid' | 'used' | 'expired' | 'missing' }
  | { kind: 'done'; destination: string };

const INVALID_COPY: Record<'invalid' | 'used' | 'expired' | 'missing', { title: string; body: string }> = {
  expired: {
    title: 'This link has expired',
    body: 'Reset links last 30 minutes, for your security. Request a new one — it only takes a moment.',
  },
  used: {
    title: 'This link has already been used',
    body: 'Each reset link works once. If you still need to change your password, request a new link.',
  },
  invalid: {
    title: 'This link is not valid',
    body: 'It may have been copied incompletely, or a newer link replaced it. Request a new one.',
  },
  missing: {
    title: 'No reset link found',
    body: 'Open the link from your reset email, or request a new one.',
  },
};

/**
 * Step two of a password reset: the page the email link opens.
 *
 * The secret is read from the URL once, then removed from the address bar so it
 * does not linger in browser history. The link is checked before the form is
 * shown, so nobody types a new password into a page that was never going to
 * accept it.
 */
export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { applyAuth } = useSession();

  const [token] = useState(() => params.get('token') ?? '');
  const [state, setState] = useState<LinkState>({ kind: 'checking' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.get('token')) window.history.replaceState(null, '', '/reset-password');
    // Only on first load: the token is already captured in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid', reason: 'missing' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await api.post<{ valid: boolean; reason?: 'invalid' | 'used' | 'expired' }>(
          '/auth/reset-password/check',
          { token },
          { token: null },
        );
        if (cancelled) return;
        setState(result.valid ? { kind: 'valid' } : { kind: 'invalid', reason: result.reason ?? 'invalid' });
      } catch {
        // If the check itself fails (network), let them try — the reset call
        // will give a precise answer.
        if (!cancelled) setState({ kind: 'valid' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = password.length >= 8 && confirm === password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<AuthResponse>('/auth/reset-password', { token, password }, { token: null });
      applyAuth(result);
      const destination = homeFor(result.user.role);
      setState({ kind: 'done', destination });
      window.setTimeout(() => router.push(destination), 2500);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code.startsWith('reset_')) {
        const reason = caught.code.replace('reset_', '') as 'invalid' | 'used' | 'expired';
        setState({ kind: 'invalid', reason });
      } else {
        setError(
          caught instanceof ApiError
            ? caught.fields.password ?? caught.message
            : 'We could not reach Enhakkore. Check your connection and try again.',
        );
      }
      setBusy(false);
    }
  }

  if (state.kind === 'checking') {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Checking your reset link">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-6 h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (state.kind === 'invalid') {
    const copy = INVALID_COPY[state.reason];
    return (
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-sand text-ink-muted">
          <Icon.clock size={26} />
        </span>
        <h1 className="mt-6 text-h2">{copy.title}</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">{copy.body}</p>
        <ButtonLink href="/forgot-password" size="lg" full className="mt-8">
          Request a new link
        </ButtonLink>
        <Link href="/signin" className="mt-4 inline-block text-[0.875rem] font-semibold text-acacia-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (state.kind === 'done') {
    return (
      <div className="text-center" role="status">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-acacia-600 text-white">
          <Icon.check size={26} />
        </span>
        <h1 className="mt-6 text-h2">Password changed</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
          You are signed in. Any other device that was signed in to your account has been signed out.
        </p>
        <ButtonLink href={state.destination} size="lg" full className="mt-8">
          Continue
          <Icon.arrow />
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-h2">Choose a new password</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
        Use at least 8 characters. Saving it signs you out on every other device.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}

        <Input
          label="New password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          required
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={tooShort ? 'Use at least 8 characters.' : undefined}
        />

        <Input
          label="Confirm new password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={mismatch ? 'The two passwords do not match.' : undefined}
        />

        <label className="flex cursor-pointer items-center gap-2.5 text-[0.875rem] text-ink-soft">
          <input
            type="checkbox"
            checked={show}
            onChange={(event) => setShow(event.target.checked)}
            className="h-4 w-4 accent-acacia-700"
          />
          Show passwords
        </label>

        <Button type="submit" size="lg" full disabled={busy || !ready}>
          {busy ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </>
  );
}
