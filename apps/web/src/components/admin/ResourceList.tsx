'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { STATUS_LABELS, formatMoney, type ResourceDef } from '@enhakkore/shared';
import { SmartImage } from '@/components/public/SmartImage';
import { ApiError, api } from '@/lib/api';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { Panel, StatusPill, btn } from './AdminShell';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ListResult {
  items: Record<string, any>[];
  total: number;
  page: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

function cell(resource: ResourceDef, row: Record<string, any>, key: string): React.ReactNode {
  const field = resource.fields.find((item) => item.name === key);
  const value = row[key];
  if (key === resource.statusField) return <StatusPill status={String(value)} />;
  if (key === 'countryId') return row.country?.name ?? '—';
  if (key === 'cityId') return row.city?.name ?? '—';
  if (key === 'categoryId') return row.category ? `${row.category.icon ?? ''} ${row.category.name}` : '—';
  if (value === null || value === undefined || value === '') return '—';
  if (field?.type === 'money') return formatMoney({ amount: Number(value), currency: row[field.currencyField ?? 'currency'] ?? 'TZS' });
  if (field?.type === 'boolean') return value ? 'Yes' : '—';
  if (field?.type === 'datetime') return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: row.timezone || 'UTC' });
  if (field?.type === 'date') return new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
  if (Array.isArray(value)) return value.join(', ');
  const option = field?.options?.find((item) => item.value === value);
  return option?.label ?? String(value);
}

/** Every content type's list: search, status tabs, filters, sort and pages. Built for a phone first. */
export function ResourceList({ resource }: { resource: ResourceDef }) {
  const { user } = useSession();
  const [data, setData] = useState<ListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState(`${resource.defaultSort.field}:${resource.defaultSort.dir}`);
  const [page, setPage] = useState(1);

  // Links like “Activity submissions to review” open the list on a status.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('status');
    if (wanted && resource.statuses?.includes(wanted)) setStatus(wanted);
  }, [resource]);

  const load = useCallback(() => {
    const [field, dir] = sort.split(':');
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sort: field!, dir: dir!, ...(q ? { q } : {}), ...(status !== 'all' && resource.statusField ? { [resource.statusField]: status } : {}) });
    api.get<ListResult>(`/cc/r/${resource.key}?${params}`).then(setData).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Could not load.'));
  }, [resource, q, status, sort, page]);

  useEffect(() => {
    const timer = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const canCreate = can(user, `${resource.permission}.create`);
  const total = data ? Object.values(data.statusCounts).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-ink-muted">{resource.description}</p>
        {canCreate && resource.key !== 'countries' && <Link href={`/admin/r/${resource.key}/new`} className={btn.gold}>+ Add {resource.label.toLowerCase()}</Link>}
      </div>

      {resource.statuses && (
        <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
          <button onClick={() => { setStatus('all'); setPage(1); }} className={`chip ${status === 'all' ? 'chip-active' : ''}`}>All {total ? `(${total})` : ''}</button>
          {resource.statuses.map((item) => (
            <button key={item} onClick={() => { setStatus(item); setPage(1); }} className={`chip ${status === item ? 'chip-active' : ''}`}>
              {STATUS_LABELS[item] ?? item} {data?.statusCounts[item] ? `(${data.statusCounts[item]})` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder={`Search ${resource.plural.toLowerCase()}`} className="field" />
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="field sm:w-60">
          <option value="updatedAt:desc">Recently changed</option>
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value={`${resource.titleField}:asc`}>A → Z</option>
          {resource.fields.some((field) => field.name === 'startsAt') && <option value="startsAt:asc">Date, soonest first</option>}
          {resource.fields.some((field) => field.name === 'startsAt') && <option value="startsAt:desc">Date, latest first</option>}
        </select>
      </div>

      {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <Panel className="!p-0">
        {!data ? (
          <p className="p-6 text-sm text-ink-muted">Loading…</p>
        ) : data.items.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">Nothing here yet.{canCreate && resource.key !== 'countries' ? ' Use “Add” to create the first one.' : ''}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((row) => (
              <li key={row.id}>
                <Link href={`/admin/r/${resource.key}/${row.id}`} className="flex items-center gap-3 p-3 hover:bg-[#faf8f3] md:p-4">
                  {resource.imageField && (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[color:var(--color-cream-deep)]">
                      {row[resource.imageField] && <SmartImage src={row[resource.imageField]} alt="" fill sizes="56px" className="object-cover" />}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{String(row[resource.titleField] ?? '(untitled)')}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                      {resource.columns
                        .filter((key) => key !== resource.titleField && key !== resource.statusField)
                        .map((key) => (
                          <span key={key}>{cell(resource, row, key)}</span>
                        ))}
                    </p>
                  </div>
                  {resource.statusField && <StatusPill status={String(row[resource.statusField])} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button className={btn.secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button>
          <span className="text-sm text-ink-muted">Page {data.page} of {data.totalPages}</span>
          <button className={btn.secondary} disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
