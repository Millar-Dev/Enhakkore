'use client';

import { useState } from 'react';
import type { ImpactProjectDetail } from '@enhakkore/shared';
import { formatMoney } from '@enhakkore/shared';
import { Alert, Button, Icon, Progress, cx } from '@/components/ui';
import { ChoiceGroup, Input, Textarea } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { price } from '@/lib/format';
import { useSession } from '@/lib/session';

const TIERS = [5_000, 10_000, 20_000, 50_000];

/**
 * Direct contribution to a project.
 *
 * Runs through the same gateway abstraction as checkout. The panel states
 * plainly that this build simulates the transaction rather than letting the
 * success message imply a real one.
 */
export function DonatePanel({ project }: { project: ImpactProjectDetail }) {
  const { user, status } = useSession();

  const [tier, setTier] = useState<number | null>(TIERS[1]);
  const [custom, setCustom] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; simulated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amount = tier ?? (Number(custom.replace(/[^0-9]/g, '')) || 0);
  const currency = project.goal.currency;
  const closed = project.status === 'COMPLETED' || project.status === 'PAUSED';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (amount <= 0) {
      setError('Choose an amount first.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post<{ status: string; simulated: boolean; message: string }>(
        `/impact/projects/${project.slug}/donate`,
        {
          amount,
          currency,
          anonymous,
          message: message.trim() || undefined,
          donorName: user ? undefined : guestName || undefined,
          donorEmail: user ? undefined : guestEmail || undefined,
          paymentMethod: 'MOBILE_MONEY',
        },
      );
      setResult({
        ok: response.status === 'SUCCEEDED',
        message: response.message,
        simulated: response.simulated,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not process that contribution.');
    } finally {
      setBusy(false);
    }
  }

  if (closed) {
    return (
      <div className="rounded-[--radius-card] border border-line bg-white p-6">
        <Progress percent={project.progress} />
        <p className="mt-3 text-[0.875rem]">
          <span className="font-bold text-clay-600">{price(project.raised, true)}</span>
          <span className="text-ink-muted"> raised of {price(project.goal, true)}</span>
        </p>
        <Alert tone="success" className="mt-5">
          {project.status === 'COMPLETED'
            ? 'This project is complete. Its final accounting is published in the updates below.'
            : 'This project is paused and is not taking contributions right now.'}
        </Alert>
      </div>
    );
  }

  if (result?.ok) {
    return (
      <div className="rounded-[--radius-card] border border-acacia-100 bg-acacia-50 p-7 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-acacia-600 text-white">
          <Icon.check size={24} />
        </span>
        <h3 className="mt-4 text-h3 text-acacia-900">Thank you</h3>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-acacia-700">
          {price({ amount, currency })} recorded against {project.title}.
        </p>
        {result.simulated && (
          <p className="mt-4 rounded-[--radius-field] bg-white/70 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-muted">
            This was a simulated transaction — no payment provider is connected in this build and no money
            has moved.
          </p>
        )}
        <Button variant="secondary" size="sm" className="mt-5" onClick={() => setResult(null)}>
          Contribute again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[--radius-card] border border-line bg-white p-6">
      <div>
        <Progress percent={project.progress} />
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <p className="text-[0.9375rem]">
            <span className="font-bold text-clay-600">{price(project.raised, true)}</span>
            <span className="text-ink-muted"> of {price(project.goal, true)}</span>
          </p>
          <p className="text-[1.125rem] font-bold">{project.progress}%</p>
        </div>
        <p className="mt-1.5 text-[0.8125rem] text-ink-muted">
          {project.contributorCount.toLocaleString('en-GB')} contributors
        </p>
      </div>

      <hr className="my-6 border-line" />

      <h3 className="text-[1rem] font-bold tracking-tight">Support this project</h3>

      {error && (
        <Alert tone="danger" className="mt-4" role="alert">
          {error}
        </Alert>
      )}
      {result && !result.ok && (
        <Alert tone="danger" className="mt-4" role="alert">
          {result.message}
        </Alert>
      )}

      <ChoiceGroup
        className="mt-4"
        tone="impact"
        value={tier}
        onChange={(value) => {
          setTier(value);
          setCustom('');
        }}
        options={TIERS.map((value) => ({
          value,
          label: formatMoney({ amount: value, currency }, { bare: true }),
        }))}
      />

      <Input
        containerClassName="mt-4"
        label="Or another amount"
        inputMode="numeric"
        value={custom}
        onChange={(event) => {
          setCustom(event.target.value);
          setTier(null);
        }}
        placeholder={`e.g. 100000 ${currency}`}
      />

      {status !== 'authenticated' && (
        <div className="mt-4 space-y-4">
          <Input
            label="Your name"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            placeholder="So the project can thank you"
          />
          <Input
            label="Email"
            type="email"
            required
            value={guestEmail}
            onChange={(event) => setGuestEmail(event.target.value)}
            placeholder="For your receipt"
          />
        </div>
      )}

      <Textarea
        containerClassName="mt-4"
        label="Message (optional)"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Anything you would like the community to know"
        rows={2}
        className="min-h-20"
      />

      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[0.875rem] text-ink-soft">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(event) => setAnonymous(event.target.checked)}
          className="h-4 w-4 accent-clay-500"
        />
        Contribute anonymously
      </label>

      <Button type="submit" variant="impact" size="lg" full className="mt-5" disabled={busy || amount <= 0}>
        {busy ? 'Processing…' : `Contribute ${amount > 0 ? price({ amount, currency }) : ''}`}
      </Button>

      <p className={cx('mt-4 text-[0.75rem] leading-relaxed text-ink-faint')}>
        Enhakkore takes no commission on contributions. In this pre-launch build the transaction is
        simulated — do not enter real payment details anywhere on this site.
      </p>
    </form>
  );
}
