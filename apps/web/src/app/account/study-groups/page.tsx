'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { ApiError, api } from '@/lib/api';

interface Group {
  id: string;
  slug: string;
  name: string;
  subject: string | null;
  coverImage: string | null;
  private: boolean;
  role: string;
  memberCount: number;
  conversationId: string | null;
  lastMessage: { preview: string; author: string; createdAt: string } | null;
  unread: number;
}

function when(iso: string) {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Account Centre → My Study Groups: the member's study-group conversations
 * (not the directory). Search at the top, Discover at the top right, and a
 * gold + to start a group.
 */
export default function MyStudyGroupsPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api
        .get<{ items: Group[] }>(`/community/groups/inbox?kind=STUDY_GROUP&q=${encodeURIComponent(q)}`)
        .then((data) => setItems(data.items))
        .catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Could not load your groups.'));
    }, q ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [q]);

  return (
    <DashboardShell
      nav={TRAVELLER_NAV}
      allow={MEMBER_ROLES}
      title="My Study Groups"
      action={<Link href="/experiences/study-groups" className="inline-flex h-10 items-center gap-1 rounded-full border border-acacia-600/30 bg-white px-4 text-sm font-semibold text-acacia-700">⌕ Discover</Link>}
    >
      <div className="relative mx-auto max-w-2xl pb-24">
        {/* Phones: Discover sits at the top right of the page as well. */}
        <div className="mb-3 flex items-center justify-between md:hidden">
          <h2 className="text-xl font-bold">My Study Groups</h2>
          <Link href="/experiences/study-groups" className="inline-flex h-10 items-center gap-1 rounded-full border border-acacia-600/30 bg-white px-4 text-sm font-semibold text-acacia-700">⌕ Discover</Link>
        </div>
        <label className="block">
          <span className="sr-only">Search your groups and conversations</span>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search your groups and conversations…" className="h-11 w-full rounded-full border border-line bg-white px-4 text-[0.9375rem] outline-none focus:border-acacia-600" />
        </label>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {items === null ? <li className="p-4 text-sm text-ink-muted">Loading…</li> : items.length === 0 ? (
            <li className="p-6 text-center text-sm text-ink-soft">
              {q ? 'No groups match.' : 'You have not joined a study group yet.'}{' '}
              <Link href="/experiences/study-groups" className="font-semibold text-acacia-700 underline">Discover study groups</Link> or start one with the + button.
            </li>
          ) : items.map((group) => (
            <li key={group.id}>
              <Link href={group.conversationId ? `/account/chats/${group.conversationId}` : `/experiences/communities/${group.slug}`} className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 hover:bg-sand">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#06152a] text-xl text-clay-400" aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {group.coverImage ? <img src={group.coverImage} alt="" className="h-full w-full object-cover" /> : '📚'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{group.name}{group.private && <span className="ml-1 text-xs" aria-label="Private">🔒</span>}</span>
                    {group.lastMessage && <span className="shrink-0 text-xs text-ink-muted">{when(group.lastMessage.createdAt)}</span>}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${group.unread ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
                      {group.lastMessage ? `${group.lastMessage.author}: ${group.lastMessage.preview}` : `${group.memberCount} member${group.memberCount === 1 ? '' : 's'}${group.subject ? ` · ${group.subject}` : ''}`}
                    </span>
                    {group.unread > 0 && <span className="min-w-6 shrink-0 rounded-full bg-clay-400 px-2 text-center text-xs font-bold leading-6 text-acacia-700">{group.unread}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/experiences/study-groups/new"
          aria-label="Create a study group"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-clay-400 text-3xl font-light text-acacia-700 shadow-[0_8px_24px_rgba(6,21,42,0.35)] md:bottom-8 md:right-8"
        >
          +
        </Link>
      </div>
    </DashboardShell>
  );
}
