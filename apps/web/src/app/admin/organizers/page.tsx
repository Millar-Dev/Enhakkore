'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { OrganizerDetail, Paginated } from '@enhakkore/shared';
import { VERIFICATION_STATUS_LABELS } from '@enhakkore/shared';
import { DashboardShell, ADMIN_NAV } from '@/components/layout/DashboardShell';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  Skeleton,
  cx,
} from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface AdminOrganizer extends OrganizerDetail {
  contactEmail: string;
  contactName: string;
  accountStatus: string;
  verification: {
    legalName: string;
    registrationNumber: string | null;
    licenseNumber: string | null;
    contactPhone: string;
    status: string;
    submittedAt: string;
    documents: string;
  } | null;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'PENDING', label: 'Pending review' },
  { id: 'VERIFIED', label: 'Verified' },
  { id: 'UNSUBMITTED', label: 'Not submitted' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'SUSPENDED', label: 'Suspended' },
];

function OrganizerQueue() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? 'all');
  const [organizers, setOrganizers] = useState<AdminOrganizer[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setOrganizers(null);
    try {
      const result = await api.get<Paginated<AdminOrganizer>>(
        `/admin/organizers?status=${status}&pageSize=50`,
      );
      setOrganizers(result.items);
    } catch {
      setOrganizers([]);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(organizer: AdminOrganizer, decision: 'VERIFIED' | 'REJECTED' | 'SUSPENDED') {
    const note = notes[organizer.id]?.trim();
    if (decision !== 'VERIFIED' && !note) {
      setError('Add a note explaining the decision — the operator receives it.');
      return;
    }

    setBusyId(organizer.id);
    setError(null);
    setNotice(null);
    try {
      await api.post(`/admin/organizers/${organizer.id}/verification`, { decision, notes: note });
      setNotice(
        decision === 'VERIFIED'
          ? `${organizer.companyName} is now verified and can publish listings.`
          : `${organizer.companyName} set to ${decision.toLowerCase()}.`,
      );
      setNotes((current) => ({ ...current, [organizer.id]: '' }));
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That decision could not be saved.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {notice && (
        <Alert tone="success" className="mb-6">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-6" role="alert">
          {error}
        </Alert>
      )}

      <Alert tone="neutral" className="mb-6">
        Verification is a human decision. Approving here is what creates the &ldquo;Verified
        operator&rdquo; badge travellers rely on — check the registry and call the contact number before
        you do.
      </Alert>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatus(filter.id)}
            aria-pressed={status === filter.id}
            className={cx(
              'h-10 shrink-0 rounded-[--radius-pill] border px-4 text-[0.8125rem] font-semibold transition-all',
              status === filter.id
                ? 'border-ink bg-ink text-white'
                : 'border-line-strong bg-white text-ink-soft hover:border-ink',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {organizers === null ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-56 w-full" />
          ))}
        </div>
      ) : organizers.length === 0 ? (
        <EmptyState
          icon={<Icon.shield size={34} />}
          title="Nothing in this queue"
          description="No operator accounts match that filter right now."
        />
      ) : (
        <div className="space-y-5">
          {organizers.map((organizer) => {
            const documents = safeParse(organizer.verification?.documents);
            return (
              <Card key={organizer.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar name={organizer.companyName} src={organizer.logoUrl} size="lg" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-h3">{organizer.companyName}</h2>
                        {organizer.isDemo && <Badge tone="neutral">Demo account</Badge>}
                      </div>
                      <p className="mt-1 text-[0.875rem] text-ink-muted">
                        {organizer.city}
                        {organizer.country && `, ${organizer.country}`}
                        {organizer.yearFounded && ` · founded ${organizer.yearFounded}`}
                      </p>
                      <p className="mt-1 text-[0.8125rem] text-ink-muted">
                        {organizer.contactName} · {organizer.contactEmail}
                        {organizer.verification && ` · ${organizer.verification.contactPhone}`}
                      </p>
                    </div>
                  </div>

                  <Badge
                    tone={
                      organizer.verificationStatus === 'VERIFIED'
                        ? 'success'
                        : organizer.verificationStatus === 'PENDING'
                          ? 'warning'
                          : organizer.verificationStatus === 'REJECTED' ||
                              organizer.verificationStatus === 'SUSPENDED'
                            ? 'danger'
                            : 'neutral'
                    }
                  >
                    {VERIFICATION_STATUS_LABELS[organizer.verificationStatus]}
                  </Badge>
                </div>

                {organizer.bio && (
                  <p className="mt-5 max-w-3xl text-[0.875rem] leading-relaxed text-ink-soft">
                    {organizer.bio}
                  </p>
                )}

                <Divider className="my-5" />

                {organizer.verification ? (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Legal name" value={organizer.verification.legalName} />
                    <Field
                      label="Registration no."
                      value={organizer.verification.registrationNumber ?? '—'}
                    />
                    <Field label="Licence no." value={organizer.verification.licenseNumber ?? '—'} />
                    <Field
                      label="Submitted"
                      value={formatDate(organizer.verification.submittedAt, 'long')}
                    />
                  </div>
                ) : (
                  <p className="text-[0.875rem] text-ink-muted">
                    This operator has not submitted verification details yet.
                  </p>
                )}

                {documents.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
                      Documents submitted
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {documents.map((document, index) => (
                        <li key={index}>
                          <Badge tone="neutral">{document.label}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1">
                    <span className="mb-1.5 block text-[0.8125rem] font-semibold">
                      Decision note{' '}
                      <span className="font-normal text-ink-muted">— sent to the operator</span>
                    </span>
                    <input
                      value={notes[organizer.id] ?? ''}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [organizer.id]: event.target.value }))
                      }
                      placeholder="e.g. Licence expired in March — send a current one."
                      className="h-11 w-full rounded-[--radius-field] border border-line-strong px-3.5 text-[0.875rem] focus:border-acacia-600 focus:outline-none"
                    />
                  </label>

                  <div className="flex shrink-0 gap-2">
                    {organizer.verificationStatus !== 'VERIFIED' && (
                      <Button
                        size="sm"
                        onClick={() => decide(organizer, 'VERIFIED')}
                        disabled={busyId === organizer.id || !organizer.verification}
                        title={organizer.verification ? undefined : 'Nothing submitted to verify'}
                      >
                        <Icon.check size={15} />
                        Verify
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => decide(organizer, 'REJECTED')}
                      disabled={busyId === organizer.id}
                    >
                      Reject
                    </Button>
                    {organizer.verificationStatus !== 'SUSPENDED' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => decide(organizer, 'SUSPENDED')}
                        disabled={busyId === organizer.id}
                      >
                        Suspend
                      </Button>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-faint">
                  Suspending unpublishes every live listing from this operator immediately.
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 text-[0.875rem] font-medium">{value}</p>
    </div>
  );
}

function safeParse(value: string | undefined): { label: string }[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AdminOrganizersPage() {
  return (
    <DashboardShell nav={ADMIN_NAV} allow={['ADMIN']} title="Organizers" wide>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OrganizerQueue />
      </Suspense>
    </DashboardShell>
  );
}
