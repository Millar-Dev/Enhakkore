'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { Alert, Button, Icon } from '@/components/ui';
import { Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';

/**
 * Step one of a password reset: ask for the email address.
 *
 * The confirmation is the same whether or not the address has an account —
 * the API answers identically too — so this page cannot be used to find out
 * who is registered.
 */
function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError(undefined);
    try {
      const result = await api.post<{ message: string }>('/auth/forgot-password', { email }, { token: null });
      setSent(result.message);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldError(caught.fields.email);
        if (!caught.fields.email) setError(caught.message);
      } else {
        setError('We could not reach Enhakkore. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-acacia-50 text-acacia-700">
          <Icon.check size={26} />
        </span>
        <h1 className="mt-6 text-h2">Check your email</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">{sent}</p>

        <div className="mt-8 rounded-[--radius-card] border border-line bg-sand/60 p-5 text-left">
          <p className="text-[0.8125rem] font-semibold text-ink">Nothing arrived?</p>
          <ul className="mt-2 space-y-1.5 text-[0.8125rem] leading-relaxed text-ink-muted">
            <li>· Check your spam or promotions folder.</li>
            <li>· Make sure it is the address you signed up with.</li>
            <li>· You can ask for a new link after a minute. Only the newest link works.</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Button variant="secondary" size="lg" full onClick={() => setSent(null)}>
            Try a different email
          </Button>
          <Link href="/signin" className="text-[0.875rem] font-semibold text-acacia-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-h2">Forgot your password?</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
        Enter the email you signed up with and we will send you a link to choose a new one.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError}
          placeholder="you@example.com"
        />

        <Button type="submit" size="lg" full disabled={busy || email.trim().length === 0}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[0.875rem] text-ink-muted">
        Remembered it?{' '}
        <Link href="/signin" className="font-semibold text-acacia-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand/40 px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 inline-block">
          <Logo size="md" withDescriptor />
        </Link>
        <div className="rounded-[--radius-card] border border-line bg-white p-7 md:p-9">
          <Suspense fallback={null}>
            <ForgotPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
