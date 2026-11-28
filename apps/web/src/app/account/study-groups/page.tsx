'use client';

import Link from 'next/link';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { useApi } from '@/lib/useApi';

interface Row { id: string; slug: string; name: string; subject: string | null; topic: string | null; role: string; status: string; private: boolean; memberCount: number }

/** The study groups the member runs, belongs to, or asked to join. */
export default function MyStudyGroups() {
  const { data, error } = useApi<{ items: Row[] }>('/community/study-groups/mine');
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="My study groups">
      <div className="flex flex-wrap gap-2">
        <Link href="/experiences/study-groups/new" className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">＋ Create a study group</Link>
        <Link href="/experiences/study-groups" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold text-acacia-700">Find a group</Link>
      </div>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {!data && !error && <p className="mt-4 text-sm text-ink-muted">Loading…</p>}
      {data?.items.length === 0 && <p className="mt-6 text-sm text-ink-soft">You are not in any study group yet.</p>}
      <ul className="mt-5 grid max-w-2xl gap-2">
        {data?.items.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-white p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link href={`/experiences/communities/${row.slug}`} className="font-semibold text-ink hover:underline">{row.name}</Link>
              <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-bold text-acacia-700">{row.status === 'PENDING' ? 'Request sent' : row.role === 'ADMIN' ? 'Admin' : row.role === 'MODERATOR' ? 'Moderator' : 'Member'}</span>
            </div>
            <p className="text-xs text-ink-muted">{[row.subject, row.topic].filter(Boolean).join(' — ')} · {row.memberCount} member{row.memberCount === 1 ? '' : 's'}{row.private ? ' · private' : ''}</p>
            {row.status === 'ACTIVE' && (
              <div className="mt-2 flex gap-3 text-xs font-semibold">
                <Link href={`/account/chats/open?type=COMMUNITY&id=${row.id}`} className="text-acacia-700">Open chat</Link>
                {(row.role === 'ADMIN' || row.role === 'MODERATOR') && <Link href={`/experiences/communities/${row.slug}#manage`} className="text-acacia-700">Manage</Link>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </DashboardShell>
  );
}
