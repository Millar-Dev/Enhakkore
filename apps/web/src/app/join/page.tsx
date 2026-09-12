'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { Alert, Button, Icon, cx } from '@/components/ui';
import { Checkbox, Input } from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { homeFor, useSession } from '@/lib/session';

type AccountType = 'TRAVELER' | 'ORGANIZER';

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { register } = useSession();

  const [accountType, setAccountType] = useState<AccountType>(
    params.get('type') === 'organizer' ? 'ORGANIZER' : 'TRAVELER',
  );
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    country: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!agreed) {
      setError('Please accept the terms to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const user = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        accountType,
        country: form.country || undefined,
        companyName: accountType === 'ORGANIZER' ? form.companyName : undefined,
      });
      // New operators go straight to verification — it is the only thing that
      // unblocks everything else for them.
      router.push(accountType === 'ORGANIZER' ? '/organizer/verification' : homeFor(user.role));
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

  return (
    <div className="w-full max-w-md">
      <Link href="/" className="inline-block">
        <Logo size="md" withDescriptor />
      </Link>

      <h1 className="mt-10 text-h1 text-balance">
        {accountType === 'ORGANIZER' ? 'List your trips' : 'Start your next journey'}
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
        {accountType === 'ORGANIZER'
          ? 'Create an operator account, submit your details for verification, and publish your first trip.'
          : 'Join group departures, request private trips, and follow the projects you support.'}
      </p>

      {/* Account type is the first decision — it changes everything after it. */}
      <div className="mt-8 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
        {(
          [
            { value: 'TRAVELER', title: 'I want to travel', icon: Icon.compass },
            { value: 'ORGANIZER', title: 'I run trips', icon: Icon.ticket },
          ] as const
        ).map((option) => {
          const OptionIcon = option.icon;
          const active = accountType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setAccountType(option.value)}
              className={cx(
                'flex flex-col items-start gap-2.5 rounded-[--radius-card] border p-4 text-left transition-all duration-150',
                active ? 'border-ink bg-ink/[0.03] ring-1 ring-ink' : 'border-line-strong hover:border-ink',
              )}
            >
              <OptionIcon size={20} className={active ? 'text-acacia-700' : 'text-ink-muted'} />
              <span className="text-[0.875rem] font-bold leading-tight tracking-tight">{option.title}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}

        <Input
          label="Full name"
          required
          autoComplete="name"
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          error={fields.name}
          placeholder="Your name"
        />

        {accountType === 'ORGANIZER' && (
          <Input
            label="Company or operating name"
            required
            value={form.companyName}
            onChange={(event) => set('companyName', event.target.value)}
            error={fields.companyName}
            placeholder="e.g. Serengeti Collective"
            hint="This is the name travellers will see on your listings."
          />
        )}

        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(event) => set('email', event.target.value)}
          error={fields.email}
          placeholder="you@example.com"
        />

        <Input
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => set('password', event.target.value)}
          error={fields.password}
          placeholder="At least 8 characters"
          hint="Use at least 8 characters."
        />

        <Input
          label="Country"
          value={form.country}
          onChange={(event) => set('country', event.target.value)}
          error={fields.country}
          placeholder="Tanzania"
        />

        <Checkbox
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          label={
            <>
              I agree to the{' '}
              <Link href="/legal/terms" className="text-acacia-700 underline">
                terms
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" className="text-acacia-700 underline">
                privacy policy
              </Link>
            </>
          }
        />

        <Button type="submit" size="lg" full disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>

      {accountType === 'ORGANIZER' && (
        <Alert tone="neutral" className="mt-5">
          Operator accounts go through verification before any listing can be published. You can build
          drafts straight away — the Enhakkore team reviews your documents before they go live.
        </Alert>
      )}

      <p className="mt-6 text-center text-[0.875rem] text-ink-muted">
        Already have an account?{' '}
        <Link href="/signin" className="font-semibold text-acacia-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <div className="flex items-center justify-center px-6 py-12 md:px-12">
        <Suspense fallback={null}>
          <JoinForm />
        </Suspense>
      </div>

      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1400&h=1800&q=85"
          alt="A group of friends together outdoors"
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 scrim" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-md text-[1.75rem] font-bold leading-tight tracking-tight text-white text-balance">
            The best part of most trips is who you meet on them.
          </p>
        </div>
      </div>
    </div>
  );
}
