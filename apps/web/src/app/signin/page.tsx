'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { Alert, Button, Card, Divider } from '@/components/ui';
import { Input } from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { homeFor, useSession } from '@/lib/session';

/** Demo accounts, surfaced so the build can be reviewed without a signup flow. */
const DEMO_ACCOUNTS = [
  { label: 'Traveller', email: 'michael@traveller.demo', note: 'bookings, a trip group, impact history' },
  { label: 'Tour operator', email: 'trips@tanzuexpeditions.demo', note: 'verified — runs the Mikumi trip' },
  { label: 'Admin', email: 'admin@enhakkore.com', note: 'review queues and platform reporting' },
];

const DEMO_PASSWORD = 'Enhakkore2026!';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const next = params.get('next');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const user = await signIn(email, password);
      router.push(next ?? homeFor(user.role));
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFields(caught.fields);
      } else {
        setError('We could not reach Enhakkore. Check your connection and try again.');
      }
      setBusy(false);
    }
  }

  function useDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <div className="w-full max-w-md">
      <Link href="/" className="inline-block">
        <Logo size="md" withDescriptor />
      </Link>

      <h1 className="mt-10 text-h1">Welcome back</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
        Sign in to see your trips, your groups and the projects you support.
      </p>

      {next && (
        <Alert tone="info" className="mt-6">
          Sign in to continue with your booking — we have kept your place.
        </Alert>
      )}

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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fields.email}
          placeholder="you@example.com"
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fields.password}
          placeholder="••••••••"
        />

        <div className="-mt-1 flex justify-end">
          <Link
            href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : '/forgot-password'}
            className="text-[0.8125rem] font-semibold text-acacia-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" full disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[0.875rem] text-ink-muted">
        New here?{' '}
        <Link href="/join" className="font-semibold text-acacia-700 hover:underline">
          Create an account
        </Link>
      </p>

      {/* Demo access. Remove this block when real accounts exist. */}
      <Card className="mt-10 bg-sand/60 p-5">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Demonstration accounts
        </p>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-muted">
          This is a pre-launch build. Use any account below to explore each role — the password is{' '}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[0.75rem] text-ink">
            {DEMO_PASSWORD}
          </code>
        </p>
        <Divider className="my-4" />
        <ul className="space-y-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => useDemo(account.email)}
                className="flex w-full items-center justify-between gap-3 rounded-[--radius-field] bg-white px-3.5 py-2.5 text-left transition-colors hover:bg-white/60"
              >
                <span className="min-w-0">
                  <span className="block text-[0.8125rem] font-bold text-ink">{account.label}</span>
                  <span className="block truncate text-[0.75rem] text-ink-muted">{account.note}</span>
                </span>
                <span className="shrink-0 text-[0.75rem] font-semibold text-acacia-700">Use</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <div className="flex items-center justify-center px-6 py-12 md:px-12">
        <Suspense fallback={null}>
          <SignInForm />
        </Suspense>
      </div>

      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1400&h=1800&q=85"
          alt="A single acacia against a sunset sky"
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 scrim" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-md text-[1.75rem] font-bold leading-tight tracking-tight text-white text-balance">
            Travel together. Experience more. Give back.
          </p>
          <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-white/70">
            Every trip on Enhakkore comes with the people you are travelling with, and the chance to leave
            something behind.
          </p>
        </div>
      </div>
    </div>
  );
}
