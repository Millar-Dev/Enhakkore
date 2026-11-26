'use client';

import Link from 'next/link';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { useApi } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Every trip departure's private group. Open one to read, pin, remove messages or participants, or archive it. */
export default function ChatsPage() {
  const { data } = useApi<{ openReports: number; items: any[] }>('/cc/chats');
  return (
    <AdminShell title="Trip group chats" permission="trips.view">
      {data && data.openReports > 0 && (
        <p className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {data.openReports} reported message{data.openReports === 1 ? '' : 's'} waiting — <Link href="/admin/moderation" className="font-bold underline">review them</Link>.
        </p>
      )}
      <Panel className="!p-0">
        {!data ? <p className="p-5 text-sm text-ink-muted">Loading…</p> : data.items.length === 0 ? <p className="p-5 text-sm text-ink-muted">No trip groups yet. A group opens when the first traveller on a departure is confirmed.</p> : (
          <ul className="divide-y divide-line">
            {data.items.map((chat) => (
              <li key={chat.id}>
                <Link href={`/account/groups/${chat.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-sand">
                  <span>
                    <span className="block font-semibold text-ink">{chat.title}</span>
                    <span className="block text-xs text-ink-muted">{new Date(chat.startDate).toLocaleDateString('en-GB')} → {new Date(chat.endDate).toLocaleDateString('en-GB')} · {chat.members} participants · {chat.messages} messages{chat.lastMessageAt ? ` · last ${new Date(chat.lastMessageAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${chat.archivedAt || new Date(chat.endDate).getTime() + 30 * 86400000 < Date.now() ? 'bg-sand text-ink-muted' : 'bg-safari-50 text-safari-700'}`}>
                    {chat.archivedAt || new Date(chat.endDate).getTime() + 30 * 86400000 < Date.now() ? 'Archived (read-only)' : 'Active'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="mt-4 text-xs text-ink-muted">Only confirmed participants and authorised team members can open a group. Groups become read-only 30 days after the trip ends, or when archived; history is kept.</p>
    </AdminShell>
  );
}
