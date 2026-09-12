'use client';

import { useEffect, useState } from 'react';
import { VERIFICATION_STATUS_LABELS } from '@enhakkore/shared';
import { DashboardShell, ORGANIZER_NAV } from '@/components/layout/DashboardShell';
import { Alert, Badge, Button, Card, Divider, Icon, cx } from '@/components/ui';
import { Input, Select } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useSession } from '@/lib/session';

/**
 * Organizer verification.
 *
 * Submitting this does not grant anything. It creates a record for an admin to
 * review, and only that admin decision sets the VERIFIED status that produces a
 * badge. The copy on this page says so plainly, because a verification process
 * that implies more than it does is worse than none.
 */

const DOCUMENTS = [
  { label: 'Certificate of incorporation', required: true },
  { label: 'Tour operator licence (TALA or equivalent)', required: true },
  { label: 'Tax identification certificate', required: true },
  { label: 'Public liability insurance', required: false },
  { label: 'Proof of address', required: false },
];

export default function VerificationPage() {
  const { organizer, refresh } = useSession();

  const [form, setForm] = useState({
    legalName: '',
    registrationNumber: '',
    taxId: '',
    licenseNumber: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    addressLine: '',
    payoutMethod: 'MOBILE_MONEY',
    payoutReference: '',
  });
  const [documents, setDocuments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!organizer) return;
    setForm((current) => ({
      ...current,
      legalName: current.legalName || `${organizer.companyName} Limited`,
    }));
  }, [organizer]);

  const status = organizer?.verificationStatus ?? 'UNSUBMITTED';
  const verified = status === 'VERIFIED';
  const pending = status === 'PENDING';

  function toggleDocument(label: string) {
    setDocuments((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.post('/organizers/me/verification', {
        ...form,
        documents: documents.map((label) => ({ label, fileName: 'submitted-offline.pdf' })),
      });
      await refresh();
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFields(caught.fields);
      } else {
        setError('We could not submit your details. Try again in a moment.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell nav={ORGANIZER_NAV} allow={['ORGANIZER']} title="Verification">
      <div className="mx-auto max-w-3xl">
        {/* Status */}
        <Card
          className={cx(
            'p-6 md:p-8',
            verified ? 'border-acacia-100 bg-acacia-50' : pending ? 'border-line bg-sand/60' : '',
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
                Current status
              </p>
              <h2 className={cx('mt-2 text-h2', verified && 'text-acacia-900')}>
                {VERIFICATION_STATUS_LABELS[status]}
              </h2>
            </div>
            <Badge
              tone={
                verified ? 'success' : pending ? 'warning' : status === 'REJECTED' ? 'danger' : 'neutral'
              }
            >
              {status.toLowerCase().replace('_', ' ')}
            </Badge>
          </div>

          <p className={cx('mt-4 max-w-xl text-[0.9375rem] leading-relaxed', verified ? 'text-acacia-700' : 'text-ink-muted')}>
            {verified &&
              'Your account is verified. Your listings can be published and travellers see the verified badge on your profile and on every trip you run.'}
            {pending &&
              'Your submission is with the Enhakkore team. We usually review within three working days. You can keep building drafts in the meantime.'}
            {status === 'UNSUBMITTED' &&
              'Submit your business details below. Until an administrator reviews and approves them, your listings stay as drafts and no badge appears anywhere on your profile.'}
            {status === 'REJECTED' &&
              'We could not verify this account with what was submitted. Check the notes we emailed you, update the details below and submit again.'}
            {status === 'SUSPENDED' &&
              'This account is suspended and its listings have been unpublished. Contact support@enhakkore.com to discuss it.'}
          </p>

          {organizer?.isDemo && (
            <Alert tone="neutral" className="mt-6">
              This is a demonstration account. Its verified status was set by the development seed — no real
              documents were submitted and no real check was performed.
            </Alert>
          )}
        </Card>

        {done && (
          <Alert tone="success" className="mt-6" title="Submitted">
            Your details are with the Enhakkore team. We will email you when a decision is made.
          </Alert>
        )}

        {/* What verification means */}
        <Card className="mt-6 p-6 md:p-8">
          <h2 className="text-h3">What verification actually checks</h2>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">
            Travellers are handing money and several days of their life to a company they found online. This
            is what stands behind that.
          </p>

          <ul className="mt-6 space-y-4">
            {[
              {
                title: 'The company exists and you run it',
                body: 'Registration documents are checked against the registry, and the contact details are confirmed by phone.',
              },
              {
                title: 'You are licensed to operate tours',
                body: 'A current tour operator licence for the country you work in, checked for expiry.',
              },
              {
                title: 'Payouts go somewhere accountable',
                body: 'A payout destination in the business name. Full account credentials are held by the payment provider, never by Enhakkore.',
              },
              {
                title: 'Listings are reviewed separately',
                body: 'Verification covers the business. Each individual trip is reviewed on its own before it publishes.',
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <Icon.check size={18} className="mt-0.5 shrink-0 text-acacia-600" />
                <div>
                  <p className="text-[0.9375rem] font-semibold">{item.title}</p>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Form */}
        {!verified && (
          <form onSubmit={submit} className="mt-6">
            <Card className="p-6 md:p-8">
              <h2 className="text-h3">Your details</h2>

              {error && (
                <Alert tone="danger" className="mt-5" role="alert">
                  {error}
                </Alert>
              )}

              <div className="mt-6 space-y-5">
                <Input
                  label="Registered legal name"
                  required
                  value={form.legalName}
                  onChange={(event) => setForm({ ...form, legalName: event.target.value })}
                  error={fields.legalName}
                  hint="Exactly as it appears on your certificate of incorporation."
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <Input
                    label="Company registration number"
                    value={form.registrationNumber}
                    onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })}
                    error={fields.registrationNumber}
                  />
                  <Input
                    label="Tax identification number"
                    value={form.taxId}
                    onChange={(event) => setForm({ ...form, taxId: event.target.value })}
                    error={fields.taxId}
                  />
                </div>

                <Input
                  label="Tour operator licence number"
                  value={form.licenseNumber}
                  onChange={(event) => setForm({ ...form, licenseNumber: event.target.value })}
                  error={fields.licenseNumber}
                  hint="TALA number in Tanzania, or the equivalent where you operate."
                />

                <Input
                  label="Registered address"
                  value={form.addressLine}
                  onChange={(event) => setForm({ ...form, addressLine: event.target.value })}
                  error={fields.addressLine}
                />
              </div>

              <Divider className="my-7" />

              <h3 className="text-[0.9375rem] font-bold tracking-tight">Who we contact</h3>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Input
                  label="Contact name"
                  required
                  value={form.contactName}
                  onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                  error={fields.contactName}
                />
                <Input
                  label="Contact email"
                  type="email"
                  required
                  value={form.contactEmail}
                  onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
                  error={fields.contactEmail}
                />
                <Input
                  label="Contact phone"
                  required
                  value={form.contactPhone}
                  onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
                  error={fields.contactPhone}
                  placeholder="+255 7XX XXX XXX"
                  containerClassName="sm:col-span-2"
                  hint="We call this number as part of the check."
                />
              </div>

              <Divider className="my-7" />

              <h3 className="text-[0.9375rem] font-bold tracking-tight">Documents</h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">
                File upload is not connected in this build. Tick what you can provide and email the files to{' '}
                <a href="mailto:verify@enhakkore.com" className="font-semibold text-acacia-700 underline">
                  verify@enhakkore.com
                </a>{' '}
                — this form records which documents you are submitting.
              </p>

              <ul className="mt-5 space-y-2.5">
                {DOCUMENTS.map((document) => (
                  <li key={document.label}>
                    <label
                      className={cx(
                        'flex cursor-pointer items-center gap-3 rounded-[--radius-field] border px-4 py-3 transition-colors',
                        documents.includes(document.label)
                          ? 'border-acacia-600 bg-acacia-50'
                          : 'border-line-strong hover:border-ink',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={documents.includes(document.label)}
                        onChange={() => toggleDocument(document.label)}
                        className="h-4 w-4 accent-acacia-700"
                      />
                      <span className="flex-1 text-[0.875rem] font-medium">{document.label}</span>
                      {document.required && (
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-clay-600">
                          Required
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>

              <Divider className="my-7" />

              <h3 className="text-[0.9375rem] font-bold tracking-tight">Payouts</h3>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Select
                  label="Payout method"
                  value={form.payoutMethod}
                  onChange={(event) => setForm({ ...form, payoutMethod: event.target.value })}
                >
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="BANK">Bank account</option>
                </Select>
                <Input
                  label="Account reference"
                  value={form.payoutReference}
                  onChange={(event) => setForm({ ...form, payoutReference: event.target.value })}
                  placeholder="Last 4 digits or account nickname"
                  hint="A reference only — never your full account number here."
                />
              </div>

              <Alert tone="neutral" className="mt-5">
                Do not enter full bank or mobile money credentials on this form. When payouts go live, full
                details are collected by the payment provider in their own secure flow, and Enhakkore never
                stores them.
              </Alert>

              <Button type="submit" size="lg" full className="mt-7" disabled={busy}>
                {busy ? 'Submitting…' : pending ? 'Update submission' : 'Submit for verification'}
              </Button>
            </Card>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}
