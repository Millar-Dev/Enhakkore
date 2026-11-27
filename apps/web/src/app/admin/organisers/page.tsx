'use client';

import { useState } from 'react';
import { EXPERIENCE_SECTIONS, EXPERIENCE_SECTION_NAMES, ORGANISER_APPLICATION_LABELS, ORGANISER_APPLICATION_STATUSES } from '@enhakkore/shared';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { ApiError, api } from '@/lib/api';
import { useApi } from '@/lib/useApi';

interface Row {
  id: string;
  legalName: string;
  phone: string;
  email: string;
  country: string | null;
  city: string | null;
  categories: string[];
  approvedCategories: string[];
  hasExperience: boolean;
  description: string;
  links: string | null;
  status: keyof typeof ORGANISER_APPLICATION_LABELS;
  reviewNotes: string | null;
  identityCheck: string | null;
  identityCheckedAt: string | null;
  createdAt: string;
  account: { id: string; name: string; username: string | null } | null;
}

/**
 * Organiser applications. Approve per category, after checking identity
 * outside the website. Record only how identity was checked — never an ID
 * number, and never upload a copy of the document.
 */
export default function OrganisersPage() {
  const [filter, setFilter] = useState('');
  const { data, reload } = useApi<{ items: Row[]; total: number }>(`/cc/organiser-applications?pageSize=60${filter ? `&status=${filter}` : ''}`);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <AdminShell title="Organiser applications" permission="experiences.view">
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter('')} className={`chip ${!filter ? 'chip-active' : ''}`}>All</button>
        {ORGANISER_APPLICATION_STATUSES.map((status) => (
          <button key={status} type="button" onClick={() => setFilter(status)} className={`chip ${filter === status ? 'chip-active' : ''}`}>{ORGANISER_APPLICATION_LABELS[status]}</button>
        ))}
      </div>
      <Panel className="!p-0">
        {!data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="p-5 text-sm text-ink-muted">No applications here.</p> : (
          <ul className="divide-y divide-line">
            {data.items.map((row) => (
              <li key={row.id} className="p-4">
                <button type="button" onClick={() => setOpen(open === row.id ? null : row.id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
                  <span>
                    <span className="block font-semibold text-ink">{row.legalName}{row.account?.username ? ` · @${row.account.username}` : ''}</span>
                    <span className="block text-xs text-ink-muted">{row.categories.map((key) => EXPERIENCE_SECTION_NAMES[key as keyof typeof EXPERIENCE_SECTION_NAMES] ?? key).join(', ')} · {[row.city, row.country].filter(Boolean).join(', ')} · {new Date(row.createdAt).toLocaleDateString('en-GB')}</span>
                  </span>
                  <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-acacia-700">{ORGANISER_APPLICATION_LABELS[row.status]}</span>
                </button>
                {open === row.id && <Review row={row} onSaved={() => { void reload(); }} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}

function Review({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const [approved, setApproved] = useState<string[]>(row.approvedCategories.length ? row.approvedCategories : row.categories);
  const [identity, setIdentity] = useState(row.identityCheck ?? '');
  const [notes, setNotes] = useState(row.reviewNotes ?? '');
  const [message, setMessage] = useState<string | null>(null);
  async function save(status: Row['status']) {
    setMessage(null);
    try {
      await api.patch(`/cc/organiser-applications/${row.id}`, { status, approvedCategories: approved, identityCheck: identity, reviewNotes: notes });
      setMessage(`Saved as “${ORGANISER_APPLICATION_LABELS[status]}”. The applicant has been notified in their account.`);
      onSaved();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'Could not save.');
    }
  }
  return (
    <div className="mt-4 grid gap-4 rounded-xl bg-sand p-4 text-sm">
      <dl className="grid gap-1 sm:grid-cols-2">
        <div><dt className="text-xs text-ink-muted">Phone</dt><dd>{row.phone}</dd></div>
        <div><dt className="text-xs text-ink-muted">Email</dt><dd className="[overflow-wrap:anywhere]">{row.email}</dd></div>
        <div><dt className="text-xs text-ink-muted">Organised before</dt><dd>{row.hasExperience ? 'Yes' : 'No'}</dd></div>
        <div><dt className="text-xs text-ink-muted">Links</dt><dd className="[overflow-wrap:anywhere]">{row.links || '—'}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-ink-muted">About</dt><dd className="whitespace-pre-line">{row.description}</dd></div>
      </dl>
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-wider text-ink-muted">Approve for</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXPERIENCE_SECTIONS.map((section) => {
            const on = approved.includes(section.key);
            return (
              <button key={section.key} type="button" aria-pressed={on} onClick={() => setApproved(on ? approved.filter((key) => key !== section.key) : [...approved, section.key])} className={`chip ${on ? 'chip-active' : ''} ${row.categories.includes(section.key) ? '' : 'opacity-60'}`}>
                {EXPERIENCE_SECTION_NAMES[section.key]}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-ink-muted">Faded categories were not asked for. Approve higher-risk categories only after an identity check.</p>
      </fieldset>
      <label className="grid gap-1 font-semibold text-ink-soft">How identity was checked (required to approve)
        <input value={identity} onChange={(e) => setIdentity(e.target.value)} maxLength={300} className="field font-normal" placeholder="e.g. Video call 12 Dec, national ID seen by Asha" />
        <span className="text-xs font-normal text-ink-muted">Do not type ID numbers and do not upload documents. {row.identityCheckedAt ? `Recorded ${new Date(row.identityCheckedAt).toLocaleDateString('en-GB')}.` : ''}</span>
      </label>
      <label className="grid gap-1 font-semibold text-ink-soft">Note to the applicant
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} className="field font-normal" placeholder="Shown to the applicant for “More information required”, “Rejected” or “Suspended”." />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => save('UNDER_REVIEW')} className="h-10 rounded-full border border-line-strong bg-white px-4 font-semibold">Mark under review</button>
        <button type="button" onClick={() => save('MORE_INFO')} className="h-10 rounded-full border border-line-strong bg-white px-4 font-semibold">Ask for more information</button>
        <button type="button" onClick={() => save('APPROVED')} className="h-10 rounded-full bg-acacia-600 px-4 font-bold text-white">Approve selected</button>
        <button type="button" onClick={() => save('REJECTED')} className="h-10 rounded-full border border-danger px-4 font-semibold text-danger">Reject</button>
        {row.status === 'APPROVED' && <button type="button" onClick={() => save('SUSPENDED')} className="h-10 rounded-full border border-danger px-4 font-semibold text-danger">Suspend</button>}
      </div>
      {message && <p role="status" className="text-ink-soft">{message}</p>}
    </div>
  );
}
