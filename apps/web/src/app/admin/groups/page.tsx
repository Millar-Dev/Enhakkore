'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdminShell, Panel } from '@/components/admin/AdminShell';
import { ApiError, api } from '@/lib/api';
import { useApi } from '@/lib/useApi';

interface Row { id: string; slug: string; name: string; kind: string; status: string; accessType: string; official: boolean; isDemo: boolean; updatedAt: string; moderationReason?: string | null }

/**
 * Communities and study groups that members create are live straight away.
 * Here the team restricts (no new members), suspends (hidden while you look
 * into it) or restores them, and can see the creator's contact (audited).
 */
export default function AdminGroupsPage() {
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data, reload } = useApi<{ items: Row[] }>(`/cc/r/communities?pageSize=100${kind ? `&kind=${kind}` : ''}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const [contact, setContact] = useState<{ id: string; name: string | null; phone: string | null; creator: { name: string; email: string; username: string | null } | null; hasPassword: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function moderate(row: Row, action: 'restrict' | 'suspend' | 'restore') {
    const reason = action === 'restore' ? undefined : window.prompt(`Why ${action} “${row.name}”? The group admins will see this.`);
    if (action !== 'restore' && !reason) return;
    try {
      await api.post(`/cc/groups/${row.id}/moderate`, { action, reason });
      setMessage(`${row.name}: ${action === 'restore' ? 'restored' : action === 'restrict' ? 'restricted' : 'suspended'}.`);
      reload();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : 'That did not work.');
    }
  }
  async function showContact(row: Row) {
    const data = await api.get<Omit<NonNullable<typeof contact>, 'id'>>(`/cc/groups/${row.id}/contact`).catch(() => null);
    if (data) setContact({ id: row.id, ...data });
  }
  return (
    <AdminShell title="Community & study-group moderation" permission="communities.view">
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="field max-w-xs" aria-label="Search" />
        {[['', 'All'], ['COMMUNITY', 'Communities'], ['STUDY_GROUP', 'Study groups']].map(([key, text]) => <button key={key} type="button" onClick={() => setKind(key!)} className={`chip ${kind === key ? 'chip-active' : ''}`}>{text}</button>)}
        {[['', 'Any status'], ['PUBLISHED', 'Live'], ['RESTRICTED', 'Restricted'], ['SUSPENDED', 'Suspended']].map(([key, text]) => <button key={key} type="button" onClick={() => setStatus(key!)} className={`chip ${status === key ? 'chip-active' : ''}`}>{text}</button>)}
      </div>
      {message && <p className="mb-3 rounded-xl bg-sand p-2 text-sm">{message}</p>}
      <Panel>
        <ul className="grid gap-2 text-sm">
          {!data ? <li className="text-ink-muted">Loading…</li> : data.items.length === 0 ? <li className="text-ink-muted">None.</li> : data.items.map((row) => (
            <li key={row.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Link href={`/experiences/communities/${row.slug}`} target="_blank" className="font-semibold underline">{row.name}</Link>
                  <span className="block text-xs text-ink-muted">{row.kind === 'STUDY_GROUP' ? 'Study group' : 'Community'} · {row.accessType === 'PRIVATE' ? 'private' : row.accessType === 'PAID' ? 'paid' : 'public'} · {row.status.toLowerCase()}{row.official ? ' · official' : ''}{row.isDemo ? ' · demo' : ''}</span>
                </span>
                <span className="flex flex-wrap gap-2 text-xs">
                  <button type="button" onClick={() => showContact(row)} className="underline">Creator contact</button>
                  <Link href={`/admin/r/communities/${row.id}`} className="underline">Edit</Link>
                  {row.status !== 'RESTRICTED' && row.status !== 'SUSPENDED' && <button type="button" onClick={() => moderate(row, 'restrict')} className="underline">Restrict</button>}
                  {row.status !== 'SUSPENDED' && <button type="button" onClick={() => moderate(row, 'suspend')} className="text-danger underline">Suspend</button>}
                  {(row.status === 'RESTRICTED' || row.status === 'SUSPENDED') && <button type="button" onClick={() => moderate(row, 'restore')} className="font-semibold underline">Restore</button>}
                </span>
              </div>
              {contact?.id === row.id && (
                <p className="mt-2 rounded-lg bg-[#fff8e6] p-2 text-xs">Contact (team only, viewing is recorded): {contact.name ?? '—'} · {contact.phone ?? '—'}{contact.creator ? ` · account ${contact.creator.name} ${contact.creator.username ? `@${contact.creator.username}` : ''} (${contact.creator.email})` : ''}{row.accessType === 'PRIVATE' ? ` · password ${contact.hasPassword ? 'set (unreadable)' : 'not set'}` : ''}</p>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </AdminShell>
  );
}
