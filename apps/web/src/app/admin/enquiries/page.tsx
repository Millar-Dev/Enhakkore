'use client';

import { useState } from 'react';
import { ENQUIRY_TYPE_LABELS, ENQUIRY_STATUSES } from '@enhakkore/shared';
import { AdminShell, Panel, StatusPill, btn } from '@/components/admin/AdminShell';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Every enquiry from the website in one inbox. Reply on WhatsApp or by phone, then mark progress. */
export default function EnquiriesPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data, reload } = useApi<{ items: any[]; statusCounts: Record<string, number> }>(`/cc/enquiries?pageSize=100${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const [open, setOpen] = useState<string | null>(null);

  const update = async (id: string, body: Record<string, unknown>) => {
    await api.patch(`/cc/enquiries/${id}`, body);
    await reload();
  };

  return (
    <AdminShell title="Enquiries inbox" permission="enquiries.view">
      <div className="no-scrollbar -mx-3 mb-3 flex gap-2 overflow-x-auto px-3">
        <button className={`chip ${status === '' ? 'chip-active' : ''}`} onClick={() => setStatus('')}>Open</button>
        {ENQUIRY_STATUSES.map((item) => <button key={item} className={`chip ${status === item ? 'chip-active' : ''}`} onClick={() => setStatus(item)}>{item.replace('_', ' ').toLowerCase()} {data?.statusCounts[item] ? `(${data.statusCounts[item]})` : ''}</button>)}
        <button className={`chip ${status === 'all' ? 'chip-active' : ''}`} onClick={() => setStatus('all')}>All</button>
      </div>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, phone, reference…" className="field mb-4" />
      <Panel className="!p-0">
        {!data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="p-5 text-sm text-ink-muted">No enquiries here.</p> : (
          <ul className="divide-y divide-line">
            {data.items.map((item) => (
              <li key={item.id} className="p-4">
                <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(open === item.id ? null : item.id)}>
                  <div className="min-w-0">
                    <p className="font-semibold">{item.name} <span className="text-xs font-normal text-ink-muted">· {ENQUIRY_TYPE_LABELS[item.type] ?? item.type}{item.subjectTitle ? ` · ${item.subjectTitle}` : ''}</span></p>
                    <p className="truncate text-sm text-ink-muted">{item.message}</p>
                    <p className="text-xs text-ink-faint">{item.reference} · {new Date(item.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <StatusPill status={item.status} />
                </button>
                {open === item.id && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-[#faf8f3] p-4 text-sm">
                    <p className="whitespace-pre-line">{item.message}</p>
                    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      {item.phone && <div><dt className="text-ink-muted">Phone</dt><dd className="font-semibold">{item.phone}</dd></div>}
                      {item.email && <div><dt className="text-ink-muted">Email</dt><dd className="font-semibold break-all">{item.email}</dd></div>}
                      {item.people && <div><dt className="text-ink-muted">People</dt><dd className="font-semibold">{item.people}</dd></div>}
                      {item.startDate && <div><dt className="text-ink-muted">Dates</dt><dd className="font-semibold">{item.startDate.slice(0, 10)}{item.endDate ? ` → ${item.endDate.slice(0, 10)}` : ''}</dd></div>}
                      {Object.entries(item.details ?? {}).map(([key, value]) => <div key={key}><dt className="text-ink-muted">{key}</dt><dd className="font-semibold">{String(value)}</dd></div>)}
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      {item.phone && <a className={btn.green} target="_blank" rel="noreferrer" href={`https://wa.me/${item.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${item.name}, this is Enhakkore replying to your enquiry ${item.reference}.`)}`}>Reply on WhatsApp</a>}
                      {item.phone && <a className={btn.secondary} href={`tel:${item.phone.replace(/\s/g, '')}`}>Call</a>}
                      {item.email && <a className={btn.secondary} href={`mailto:${item.email}?subject=${encodeURIComponent(`Your Enhakkore enquiry ${item.reference}`)}`}>Email</a>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-ink-muted">Mark as:</span>
                      {ENQUIRY_STATUSES.map((value) => <button key={value} className={`chip ${item.status === value ? 'chip-active' : ''}`} onClick={() => update(item.id, { status: value })}>{value.replace('_', ' ').toLowerCase()}</button>)}
                    </div>
                    <textarea defaultValue={item.internalNotes ?? ''} placeholder="Internal notes (only the team sees these)" className="field" onBlur={(event) => event.target.value !== (item.internalNotes ?? '') && update(item.id, { internalNotes: event.target.value })} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}
