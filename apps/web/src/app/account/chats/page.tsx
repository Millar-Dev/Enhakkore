'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { EmptyState } from '@/components/ui';
import { useApi } from '@/lib/useApi';

interface ChatItem { id: string | null; subjectType: string; subjectId: string; category: string; title: string; href: string; unreadCount: number; lastMessage: { body: string; createdAt: string; author: { name: string } } | null }

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'COMMUNITY', label: 'Communities' },
  { key: 'STUDY_GROUP', label: 'Study' },
  { key: 'TEAM', label: 'Teams' },
  { key: 'GAMING', label: 'Gaming' },
  { key: 'EVENT', label: 'Events' },
];
const KIND: Record<string, string> = { ACTIVITY: 'Activity', EVENT: 'Event', COMMUNITY: 'Community', STUDY_GROUP: 'Study group', TEAM: 'Team', TOURNAMENT: 'Tournament', GAMING_TEMP: 'Temporary gaming chat' };

/**
 * My Group Chats — one inbox for communities, study groups, teams, guilds and
 * tournaments (and events and activities). Each chat is also on its own page.
 * Trip group chats keep their own shortcut.
 */
export default function ChatsPage() {
  const [filter, setFilter] = useState('');
  const { data, error } = useApi<{ items: ChatItem[] }>(`/experience-chats${filter ? `?type=${filter}` : ''}`);
  const items = (data?.items ?? []).filter((item) => !(filter === 'EVENT' && item.category !== 'EVENT' && item.category !== 'ACTIVITY'));
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="My Group Chats">
      <div className="max-w-2xl">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Filter">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`chip shrink-0 ${filter === item.key ? 'chip-active' : ''}`}>{item.label}</button>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-muted"><Link href="/account/groups" className="font-semibold text-acacia-700 underline">Trip group chats</Link> and <Link href="/account/messages" className="font-semibold text-acacia-700 underline">private messages</Link> are kept separately.</p>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {!data && !error && <p className="mt-4 text-sm text-ink-muted">Loading…</p>}
        {data && items.length === 0 && <EmptyState className="mt-5" title="No group chats here yet" description="Join a community, study group, team or tournament and its chat appears here." />}
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {items.map((item) => (
            <li key={`${item.subjectType}-${item.subjectId}`}>
              <Link href={item.id ? `/account/chats/${item.id}` : `/account/chats/open?type=${item.subjectType}&id=${item.subjectId}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-sand">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#06152a] text-lg text-clay-400" aria-hidden>{item.category === 'STUDY_GROUP' ? '📚' : item.category === 'TEAM' ? '🛡️' : item.category === 'TOURNAMENT' || item.category === 'GAMING_TEMP' ? '🎮' : item.category === 'EVENT' ? '🎉' : '👥'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{item.title}</span>
                  <span className="block truncate text-xs text-ink-muted">{KIND[item.category] ?? item.subjectType}{item.lastMessage ? ` · ${item.lastMessage.author.name}: ${item.lastMessage.body}` : ' · No messages yet'}</span>
                </span>
                {item.unreadCount > 0 && <span className="min-w-6 rounded-full bg-clay-400 px-2 text-center text-xs font-bold leading-6 text-acacia-700">{item.unreadCount}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </DashboardShell>
  );
}
