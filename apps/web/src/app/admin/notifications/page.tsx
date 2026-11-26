'use client';

import { useState } from 'react';
import { AdminShell, Panel, StatusPill } from '@/components/admin/AdminShell';
import { useApi } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Every automatic WhatsApp or email notice the platform tried to send, and what happened. */
export default function DeliveriesPage() {
  const [status, setStatus] = useState('all');
  const { data } = useApi<{ items: any[]; statusCounts: Record<string, number>; configuration: { whatsapp: boolean; email: boolean } }>(`/cc/deliveries?status=${status}&pageSize=100`);
  return (
    <AdminShell title="Notification delivery" permission="enquiries.view">
      {data && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Panel>
            <p className="text-sm font-bold text-acacia-700">WhatsApp Business Platform</p>
            <p className={`mt-1 text-sm ${data.configuration.whatsapp ? 'text-safari-700' : 'text-warning'}`}>{data.configuration.whatsapp ? 'Connected — enquiries are sent to both team numbers automatically.' : 'Not connected. Enquiries are saved and shown in the inbox; nothing is sent automatically until WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set on the API.'}</p>
          </Panel>
          <Panel>
            <p className="text-sm font-bold text-acacia-700">Email (Resend)</p>
            <p className={`mt-1 text-sm ${data.configuration.email ? 'text-safari-700' : 'text-warning'}`}>{data.configuration.email ? 'Connected.' : 'Not connected — password-reset emails are not sent until RESEND_API_KEY is set.'}</p>
          </Panel>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        {['all', 'SENT', 'FAILED', 'NOT_CONFIGURED'].map((value) => <button key={value} className={`chip ${status === value ? 'chip-active' : ''}`} onClick={() => setStatus(value)}>{value === 'all' ? 'All' : value.replace('_', ' ').toLowerCase()} {value !== 'all' && data?.statusCounts[value] ? `(${data.statusCounts[value]})` : ''}</button>)}
      </div>
      <Panel className="!p-0">
        {!data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="p-5 text-sm text-ink-muted">Nothing yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {data.items.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <span>
                  <span className="font-semibold">{row.summary}</span>
                  <span className="block text-xs text-ink-muted">{row.channel} → {row.recipient} · {new Date(row.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{row.error ? ` · ${row.error}` : ''}</span>
                </span>
                <StatusPill status={row.status === 'NOT_CONFIGURED' ? 'PENDING' : row.status === 'SENT' ? 'SUCCEEDED' : 'FAILED'} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="mt-4 text-xs text-ink-muted">“Sent” means the WhatsApp platform accepted the message. Nothing is shown as sent unless the provider confirmed it.</p>
    </AdminShell>
  );
}
