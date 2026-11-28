'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { USERNAME_PATTERN } from '@enhakkore/shared';
import { CountryCity } from '@/components/public/CountryCity';
import { Logo } from '@/components/brand/Logo';
import { Alert, Button, Icon, cx } from '@/components/ui';
import { Checkbox, Input } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { homeFor, useSession } from '@/lib/session';

type AccountType = 'TRAVELER' | 'ORGANIZER';

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { register } = useSession();

  // Every new account is a member account. Operator accounts belong to the
  // marketplace, which is a later phase.
  const accountType: AccountType = 'TRAVELER';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    country: '',
    city: '',
    username: '',
    dateOfBirth: '',
  });
  const [nameCheck, setNameCheck] = useState<{ username: string; ok: boolean; reason?: string } | null>(null);

  // Checks the username as it is typed, after a short pause.
  useEffect(() => {
    const value = form.username.trim().toLowerCase();
    if (!value) return setNameCheck(null);
    if (!USERNAME_PATTERN.test(value)) return setNameCheck({ username: value, ok: false, reason: 'Use 3–20 lowercase letters, numbers, dots or underscores.' });
    const timer = window.setTimeout(() => {
      api.get<{ available: boolean; reason: string | null }>(`/public/username-available?u=${encodeURIComponent(value)}`, { token: null })
        .then((result) => setNameCheck({ username: value, ok: result.available, reason: result.reason ?? undefined }))
        .catch(() => setNameCheck(null));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form.username]);
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
    const missing: Record<string, string> = {};
    if (!form.username.trim()) missing.username = 'Choose a username.';
    else if (nameCheck && !nameCheck.ok) missing.username = nameCheck.reason ?? 'Choose another username.';
    if (!form.dateOfBirth) missing.dateOfBirth = 'Enter your date of birth.';
    if (!form.country) missing.country = 'Choose your country.';
    if (!form.city) missing.city = 'Choose your city.';
    if (Object.keys(missing).length) {
      setFields(missing);
      setError('Please complete the highlighted fields.');
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
        city: form.city || undefined,
        username: form.username.trim().toLowerCase(),
        acceptedTerms: true,
        dateOfBirth: form.dateOfBirth,
      });
      // New operators go straight to verification — it is the only thing that
      // unblocks everything else for them.
      router.push(params.get('next') || homeFor(user.role));
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

      <h1 className="mt-10 text-h1 text-balance [overflow-wrap:anywhere]">
        Join Enhakkore
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
        Apply for trips, join activities, find people who share your interests, and save places you love. Free.
      </p>

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


        <Input
          label="Username"
          required
          autoComplete="username"
          value={form.username}
          onChange={(event) => set('username', event.target.value.replace(/\s/g, '').toLowerCase())}
          error={fields.username ?? (nameCheck && !nameCheck.ok && nameCheck.username === form.username.trim().toLowerCase() ? nameCheck.reason : undefined)}
          hint={nameCheck?.ok ? `@${nameCheck.username} is available.` : 'Shown to other members instead of your phone number or email.'}
          placeholder="e.g. amina_runs"
          maxLength={20}
        />

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
          label="Date of birth"
          type="date"
          required
          autoComplete="bday"
          value={form.dateOfBirth}
          max={new Date(Date.now() - 13 * 365.25 * 86_400_000).toISOString().slice(0, 10)}
          onChange={(event) => set('dateOfBirth', event.target.value)}
          error={fields.dateOfBirth}
          hint="Never shown to other members. You need to be 13 or older; some features (like nearby gaming) are for adults."
        />

        <CountryCity
          required
          country={form.country}
          city={form.city}
          errors={{ country: fields.country, city: fields.city }}
          onChange={(next) => setForm((current) => ({ ...current, ...next }))}
        />
        <p className="-mt-2 text-[0.8125rem] text-ink-muted">Used to show experiences, trips and places near you first. You can change it at any time.</p>

        <Checkbox
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          label={
            <>
              I accept the{' '}
              <Link href="/legal/terms" className="text-acacia-700 underline">platform terms</Link>,{' '}
              <Link href="/legal/member" className="text-acacia-700 underline">member account terms</Link>,{' '}
              <Link href="/legal/community" className="text-acacia-700 underline">community guidelines</Link> and the{' '}
              <Link href="/legal/privacy" className="text-acacia-700 underline">privacy policy</Link>
            </>
          }
        />

        <Button type="submit" size="lg" full disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>


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
          src="/packages/arusha/chemka-1.webp"
          alt="The clear water at Chemka hot springs"
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
