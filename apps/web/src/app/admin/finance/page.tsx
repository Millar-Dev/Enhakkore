'use client';

import { useEffect, useState } from 'react';
import { DIVISION_LABELS, FINANCE_CATEGORY_LABELS, formatMoney, toMajor } from '@enhakkore/shared';
import { AdminShell, Panel, StatusPill, btn } from '@/components/admin/AdminShell';
import { sums } from '@/components/admin/ResourceExtras';
import { TransactionForm } from '@/components/admin/TransactionForm';
import { ApiError, api } from '@/lib/api';
import { downloadCsv } from '@/lib/download';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { useApi, useQueryParam } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function FinancePage() {
  const { user } = useSession();
  const addParam = useQueryParam('add');
  const [tab, setTab] = useState<'reports' | 'transactions'>('reports');
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [adding, setAdding] = useState<string | null>(null);
  const [filters, setFilters] = useState({ type: '', division: '', currency: '', q: '', from: '', to: '' });
  useEffect(() => {
    if (addParam) {
      setAdding(addParam);
      setTab('transactions');
    }
  }, [addParam]);
  const reports = useApi<any>(`/cc/finance/reports?year=${year}`);
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  const list = useApi<{ items: any[]; total: number; totals: any[] }>(`/cc/finance/transactions?pageSize=200&${query}`);
  const r = reports.data;

  const cancel = async (id: string) => {
    const reason = window.prompt('Why cancel this line? (It stays in the history.)');
    if (!reason) return;
    try {
      await api.post(`/cc/finance/transactions/${id}/cancel`, { reason });
      await Promise.all([list.reload(), reports.reload()]);
    } catch (caught) {
      window.alert(caught instanceof ApiError ? caught.message : 'Could not cancel.');
    }
  };

  return (
    <AdminShell
      title="Finance"
      permission="finance.view"
      actions={
        <>
          {can(user, 'finance.create') && <button className={btn.gold} onClick={() => { setAdding('INCOME'); setTab('transactions'); }}>+ Income</button>}
          {can(user, 'finance.create') && <button className={btn.secondary} onClick={() => { setAdding('EXPENSE'); setTab('transactions'); }}>+ Expense</button>}
          {can(user, 'finance.export') && <button className={btn.secondary} onClick={() => downloadCsv(`/cc/finance/export/transactions.csv?${query}`, `enhakkore-transactions.csv`)}>Export CSV (Excel)</button>}
        </>
      }
    >
      <p className="mb-4 rounded-xl bg-white p-3 text-xs text-ink-muted">Business money only — donations are kept in their own ledger and never counted here. Each currency is totalled separately.</p>
      <div className="mb-5 flex gap-2">
        <button className={`chip ${tab === 'reports' ? 'chip-active' : ''}`} onClick={() => setTab('reports')}>Reports</button>
        <button className={`chip ${tab === 'transactions' ? 'chip-active' : ''}`} onClick={() => setTab('transactions')}>Transactions</button>
      </div>

      {tab === 'reports' && (
        <div className="grid gap-5">
          <div className="flex items-center gap-2">
            <button className={btn.secondary} onClick={() => setYear(year - 1)}>←</button>
            <span className="font-display text-2xl text-acacia-700">{year}</span>
            <button className={btn.secondary} onClick={() => setYear(year + 1)}>→</button>
          </div>
          {!r ? <p className="text-ink-muted">Loading…</p> : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                {[['Total income', r.totals.income, 'text-safari-700'], ['Total expenses', r.totals.expenses, 'text-danger'], ['Refunds', r.totals.refunds, 'text-warning'], ['Net profit', r.totals.net, 'text-acacia-700']].map(([label, value, tone]: any) => (
                  <div key={label} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-ink-muted">{label}</p><p className={`mt-1 text-lg font-bold ${tone}`}>{sums(value)}</p></div>
                ))}
              </div>
              <Panel title="Monthly">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs text-ink-muted"><tr><th className="py-2">Month</th><th>Income</th><th>Expenses</th><th>Refunds</th><th>Net</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {r.monthly.length === 0 && <tr><td colSpan={5} className="py-3 text-ink-muted">No verified transactions this year.</td></tr>}
                      {r.monthly.map((month: any) => <tr key={month.month}><td className="py-2 font-semibold">{month.month}</td><td>{sums(month.income)}</td><td>{sums(month.expenses)}</td><td>{sums(month.refunds)}</td><td className="font-bold">{sums(month.net)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <div className="grid gap-5 md:grid-cols-2">
                <Panel title="Income by division">
                  <ul className="grid gap-1 text-sm">{Object.entries(r.byDivision).map(([key, value]: any) => <li key={key} className="flex justify-between rounded-lg bg-[#faf8f3] px-3 py-2"><span>{DIVISION_LABELS[key] ?? key}</span><strong>{sums(value)}</strong></li>)}{Object.keys(r.byDivision).length === 0 && <li className="text-ink-muted">Nothing yet.</li>}</ul>
                </Panel>
                <Panel title="Expenses by category">
                  <ul className="grid gap-1 text-sm">{Object.entries(r.expenseByCategory).map(([key, value]: any) => <li key={key} className="flex justify-between rounded-lg bg-[#faf8f3] px-3 py-2"><span>{FINANCE_CATEGORY_LABELS[key] ?? key}</span><strong>{sums(value)}</strong></li>)}{Object.keys(r.expenseByCategory).length === 0 && <li className="text-ink-muted">Nothing yet.</li>}</ul>
                </Panel>
              </div>
              <Panel title="Trip-by-trip profitability">
                <ul className="grid gap-1 text-sm">{r.departures.map((row: any) => <li key={row.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-[#faf8f3] px-3 py-2"><a className="underline" href={`/admin/departures/${row.id}`}>{row.label}</a><span>Income {sums(row.income)} · Costs {sums(row.expenses)} · <strong>Profit {sums(row.net)}</strong></span></li>)}{r.departures.length === 0 && <li className="text-ink-muted">Link income and costs to a trip date to see it here.</li>}</ul>
              </Panel>
              <Panel title="Event profitability">
                <ul className="grid gap-1 text-sm">{r.events.map((row: any) => <li key={row.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-[#faf8f3] px-3 py-2"><span>{row.label}</span><span>Tickets {sums(row.income)} · Costs {sums(row.expenses)} · <strong>Net {sums(row.net)}</strong></span></li>)}{r.events.length === 0 && <li className="text-ink-muted">No event money recorded yet.</li>}</ul>
              </Panel>
              <Panel title={`Outstanding payments · ${sums(r.outstanding.total)}`}>
                <ul className="grid gap-1 text-sm">{r.outstanding.items.map((row: any) => <li key={row.reference} className="flex justify-between gap-2 rounded-lg bg-[#faf8f3] px-3 py-2"><span>{row.kind}: {row.who} — {row.what} <span className="font-mono text-xs">{row.reference}</span></span><strong>{formatMoney({ amount: row.amount, currency: row.currency })}</strong></li>)}{r.outstanding.items.length === 0 && <li className="text-ink-muted">Nothing outstanding.</li>}</ul>
              </Panel>
              {r.pending.length > 0 && <p className="text-xs text-ink-muted">Not yet verified (not in the totals above): {r.pending.map((row: any) => `${row.type.toLowerCase()} ${formatMoney({ amount: row.amount, currency: row.currency })}`).join(' · ')}</p>}
            </>
          )}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="grid gap-5">
          {adding && (
            <Panel title="New transaction">
              <TransactionForm defaults={{ type: adding }} onDone={() => { setAdding(null); void list.reload(); void reports.reload(); }} onCancel={() => setAdding(null)} />
            </Panel>
          )}
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <select className="field" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All types</option><option value="INCOME">Income</option><option value="EXPENSE">Expense</option><option value="REFUND">Refund</option></select>
            <select className="field" value={filters.division} onChange={(event) => setFilters({ ...filters, division: event.target.value })}><option value="">All divisions</option>{Object.entries(DIVISION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <input className="field" placeholder="Currency (e.g. TZS)" value={filters.currency} onChange={(event) => setFilters({ ...filters, currency: event.target.value.toUpperCase() })} />
            <input className="field" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
            <input className="field" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
            <input className="field" placeholder="Search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
          </div>
          {list.data && list.data.totals.length > 0 && <p className="text-xs text-ink-muted">Shown: {list.data.totals.map((row: any) => `${row.type.toLowerCase()} ${formatMoney({ amount: row.amount, currency: row.currency })}`).join(' · ')}</p>}
          <Panel className="!p-0">
            {!list.data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : list.data.items.length === 0 ? <p className="p-5 text-sm text-ink-muted">No transactions match.</p> : (
              <ul className="divide-y divide-line">
                {list.data.items.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold">{FINANCE_CATEGORY_LABELS[row.category] ?? row.category}{row.relatedLabel ? ` · ${row.relatedLabel}` : ''}</p>
                      <p className="text-xs text-ink-muted">{row.date.slice(0, 10)} · {DIVISION_LABELS[row.division] ?? row.division}{row.counterparty ? ` · ${row.counterparty}` : ''}{row.reference ? ` · ${row.reference}` : ''}</p>
                      {row.notes && <p className="text-xs text-ink-soft">{row.notes}</p>}
                      {row.receiptUrl && <button className="text-xs font-semibold text-acacia-600 underline" onClick={async () => { const { url } = await api.get<{ url: string }>(`/cc/finance/receipt?ref=${encodeURIComponent(row.receiptUrl)}`); window.open(url, '_blank'); }}>Open receipt</button>}
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${row.type === 'INCOME' ? 'text-safari-700' : 'text-danger'}`}>{row.type === 'INCOME' ? '+' : '−'} {formatMoney({ amount: row.amount, currency: row.currency })}</p>
                      <StatusPill status={row.status} />
                      {row.status !== 'CANCELLED' && can(user, 'finance.edit') && row.status === 'PENDING' && <button className="ml-2 text-xs font-semibold text-acacia-600 underline" onClick={async () => { await api.patch(`/cc/finance/transactions/${row.id}`, { status: 'VERIFIED' }); await Promise.all([list.reload(), reports.reload()]); }}>Verify</button>}
                      {row.status !== 'CANCELLED' && can(user, 'finance.delete') && !row.bookingId && !row.registrationId && <button className="ml-2 text-xs font-semibold text-danger underline" onClick={() => cancel(row.id)}>Cancel</button>}
                      <p className="sr-only">{toMajor(row.amount, row.currency)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </AdminShell>
  );
}
