'use client';

import Link from 'next/link';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { useApi } from '@/lib/useApi';

interface ChatItem { id: string | null; subjectType: string; subjectId: string; title: string; href: string; unreadCount: number; lastMessage: { body: string; createdAt: string; author: { name: string } } | null }
const KIND: Record<string, string> = { ACTIVITY: 'Activity', EVENT: 'Event', COMMUNITY: 'Community' };

/** Group chats for the events, activities and communities the member takes part in. Trip groups are listed separately. */
export default function ChatsPage() {
  const { data, error } = useApi<{ items: ChatItem[] }>('/experience-chats');
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Group chats">
      <p className="max-w-2xl text-sm text-ink-muted">Chats appear for experiences you are confirmed for and communities you belong to, once the organiser switches the chat on. <Link href="/account/groups" className="font-semibold text-acacia-700 underline">Trip groups</Link> are kept separately.</p>
      {error && <p className="mt-4 text-sm text-[#b42318]">{error}</p>}
      {!data && !error && <p className="mt-4 text-sm text-ink-muted">Loading…</p>}
      {data?.items.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-soft">No group chats yet.</p>}
      <ul className="mt-5 grid max-w-2xl gap-2">
        {data?.items.map((item) => (
          <li key={`${item.subjectType}-${item.subjectId}`}>
            <Link href={`/account/chats/open?type=${item.subjectType}&id=${item.subjectId}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <span className="flex-1 overflow-hidden">
                <span className="block truncate font-semibold text-ink">{item.title}</span>
                <span className="block truncate text-xs text-ink-muted">{KIND[item.subjectType]}{item.lastMessage ? ` · ${item.lastMessage.author.name}: ${item.lastMessage.body}` : ' · No messages yet'}</span>
              </span>
              {item.unreadCount > 0 && <span className="min-w-6 rounded-full bg-clay-400 px-2 text-center text-xs font-bold leading-6 text-acacia-700">{item.unreadCount}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </DashboardShell>
  );
}
