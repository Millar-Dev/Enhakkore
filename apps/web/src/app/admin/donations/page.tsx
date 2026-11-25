'use client';

import { useState } from 'react';
import { DONATION_STATUSES, SUPPORTED_CURRENCIES, formatMoney } from '@enhakkore/shared';
import { AdminShell, Panel, StatusPill, btn } from '@/components/admin/AdminShell';
import { ApiError, api } from '@/lib/api';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { useApi, useQueryParam } from '@/lib/useApi';
import { downloadCsv } from '@/lib/download';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Donations: recorded when a donor sends a confirmation, counted only once verified. Never business income. */
export default function DonationsPage() {
  const { user } = useSession();
  const initial = useQueryParam('status');
  const [status, setStatus] = useState<string | null>(null);
  const current = status ?? initial ?? '';
  const { data, reload } = useApi<{ items: any[]; totals: any[] }>(`/cc/finance/donations?pageSize=200${current ? `&status=${current}` : ''}`);
  const projects = useApi<{ items: any[] }>('/cc/r/impact?pageSize=100');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verified = (data?.totals ?? []).filter((row) => row.status === 'SUCCEEDED');

  return (
    <AdminShell
      title="Donations"
      permission="donations.view"
      actions={
        <>
          {can(user, 'donations.create') && <button className={btn.gold} onClick={() => setAdding(true)}>+ Record a donation</button>}
          {can(user, 'donations.export') && <button className={btn.secondary} onClick={() => downloadCsv('/cc/finance/export/donations.csv', 'enhakkore-donations.csv')}>Export CSV</button>}
        </>
      }
    >
      <p className="mb-4 rounded-xl bg-white p-3 text-xs text-ink-muted">Donations are kept apart from Enhakkore’s business income and never appear in Finance. A donation counts — and shows on a project page — only once its status is “Succeeded”, meaning someone has checked the account statement.</p>
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-muted">Verified donations (all time)</p><p className="mt-1 text-lg font-bold text-safari-700">{verified.length ? verified.map((row) => formatMoney({ amount: row.amount, currency: row.currency })).join(' · ') : '—'}</p></div>
      </div>
      {adding && (
        <Panel title="Record a donation" className="mb-5">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setError(null);
              try {
                await api.post('/cc/finance/donations', {
                  amount: Number(form.get('amount')),
                  currency: String(form.get('currency')),
                  projectId: String(form.get('projectId') ?? '') || null,
                  donorName: String(form.get('donorName') ?? '') || null,
                  donorPhone: String(form.get('donorPhone') ?? '') || null,
                  anonymous: !!form.get('anonymous'),
                  method: String(form.get('method')),
                  reference: String(form.get('reference') ?? '') || null,
                  receivedAt: String(form.get('receivedAt') ?? '') || null,
                  status: form.get('verified') ? 'SUCCEEDED' : 'PENDING',
                  notes: String(form.get('notes') ?? '') || null,
                });
                setAdding(false);
                await reload();
              } catch (caught) {
                setError(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not save.');
              }
            }}
          >
            <label className="grid gap-1 text-xs font-semibold">Amount<input name="amount" type="number" step="any" min="0" required className="field" /></label>
            <label className="grid gap-1 text-xs font-semibold">Currency<select name="currency" className="field">{SUPPORTED_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-semibold">Project<select name="projectId" className="field"><option value="">General outreach</option>{(projects.data?.items ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-semibold">Method<select name="method" className="field"><option value="BANK_TRANSFER">Bank transfer</option><option value="MOBILE_MONEY">Mobile money</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label>
            <label className="grid gap-1 text-xs font-semibold">Donor name<input name="donorName" className="field" /></label>
            <label className="grid gap-1 text-xs font-semibold">Donor phone<input name="donorPhone" className="field" /></label>
            <label className="grid gap-1 text-xs font-semibold">Transfer reference<input name="reference" className="field" /></label>
            <label className="grid gap-1 text-xs font-semibold">Received on<input name="receivedAt" type="date" className="field" /></label>
            <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Notes<input name="notes" className="field" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="anonymous" /> Donor wishes to stay anonymous</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" /> I have checked the statement — mark verified</label>
            {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2"><button className={btn.primary}>Save</button><button type="button" className={btn.secondary} onClick={() => setAdding(false)}>Cancel</button></div>
          </form>
        </Panel>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <button className={`chip ${current === '' ? 'chip-active' : ''}`} onClick={() => setStatus('')}>All</button>
        {DONATION_STATUSES.map((value) => <button key={value} className={`chip ${current === value ? 'chip-active' : ''}`} onClick={() => setStatus(value)}>{value.toLowerCase()}</button>)}
      </div>
      <Panel className="!p-0">
        {!data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="p-5 text-sm text-ink-muted">No donations recorded.</p> : (
          <ul className="divide-y divide-line">
            {data.items.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-semibold">{formatMoney({ amount: row.amount, currency: row.currency })} · {row.anonymous ? 'Anonymous' : row.donorName ?? 'Unnamed'}</p>
                  <p className="text-xs text-ink-muted">{row.project?.title ?? 'General outreach'} · {row.method.replace('_', ' ').toLowerCase()}{row.reference ? ` · ${row.reference}` : ''} · {new Date(row.receivedAt ?? row.createdAt).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={row.status} />
                  {can(user, 'donations.publish') && row.status !== 'SUCCEEDED' && row.method !== 'CHECKOUT' && <button className={btn.green} onClick={async () => { if (window.confirm('Mark as verified? Only do this after checking the account statement.')) { await api.patch(`/cc/finance/donations/${row.id}`, { status: 'SUCCEEDED' }); await reload(); } }}>Verify</button>}
                  {can(user, 'donations.edit') && row.status === 'PENDING' && <button className={btn.secondary} onClick={async () => { await api.patch(`/cc/finance/donations/${row.id}`, { status: 'FAILED' }); await reload(); }}>Not received</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}
