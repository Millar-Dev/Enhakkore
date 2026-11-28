'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { NotificationSettings } from '@/components/account/NotificationSettings';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { EmptyState } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useQueryParam } from '@/lib/useApi';

interface Note { id: string; type: string; title: string; body: string; link: string | null; read: boolean; createdAt: string; category: string; archived: boolean }
interface Counts { unread: number; messages: number; requests: number; updates: number }
interface ActivityItem { id: string; action: string; label: string; title: string; link: string | null; createdAt: string }

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'messages', label: 'Messages' },
  { key: 'requests', label: 'Requests' },
  { key: 'updates', label: 'Updates' },
  { key: 'archived', label: 'Archived' },
] as const;
const ACTIVITY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'communities', label: 'Communities' },
  { key: 'study', label: 'Study groups' },
  { key: 'gaming', label: 'Gaming' },
  { key: 'events', label: 'Events & hosting' },
  { key: 'trips', label: 'Trips' },
  { key: 'saved', label: 'Saved' },
];
const ICON: Record<string, string> = { MESSAGES: '💬', REQUESTS: '🤝', UPDATES: '🔔' };

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Notifications & Activity Centre: the inbox (with tabs, search, mark read,
 * archive), the member's own activity history, and notification settings.
 */
export default function NotificationsPage() {
  const sectionParam = useQueryParam('section');
  const [section, setSection] = useState<'inbox' | 'activity' | 'settings'>('inbox');
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Note[] | null>(null);
  const [counts, setCounts] = useState<Counts>({ unread: 0, messages: 0, requests: 0, updates: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sectionParam === 'activity' || sectionParam === 'settings') setSection(sectionParam);
  }, [sectionParam]);

  const load = useCallback(async (before?: string) => {
    try {
      const data = await api.get<{ items: Note[]; counts: Counts; hasMore: boolean }>(`/me/notifications?tab=${tab}&q=${encodeURIComponent(q)}${before ? `&before=${encodeURIComponent(before)}` : ''}`);
      setItems((current) => (before && current ? [...current, ...data.items] : data.items));
      setCounts(data.counts);
      setHasMore(data.hasMore);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load notifications.');
    }
  }, [tab, q]);
  useEffect(() => {
    if (section !== 'inbox') return;
    const timer = window.setTimeout(() => void load(), q ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, q, section]);

  useEffect(() => {
    if (section !== 'activity') return;
    setActivity(null);
    api.get<{ items: ActivityItem[] }>(`/me/activity?filter=${filter}`).then((data) => setActivity(data.items)).catch(() => setActivity([]));
  }, [section, filter]);

  async function mark(ids: string[] | undefined, read = true) {
    await api.post('/me/notifications/read', { ids, read }).catch(() => undefined);
    void load();
  }
  async function archive(ids: string[] | undefined, archiveIt = true, allRead = false) {
    await api.post('/me/notifications/archive', { ids, archive: archiveIt, allRead }).catch(() => undefined);
    void load();
  }
  async function open(note: Note) {
    if (!note.read) await api.post('/me/notifications/read', { ids: [note.id] }).catch(() => undefined);
    if (note.link) window.location.href = note.link;
    else void load();
  }

  const badge = (key: string) => (key === 'unread' ? counts.unread : key === 'messages' ? counts.messages : key === 'requests' ? counts.requests : key === 'updates' ? counts.updates : 0);

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="My Notifications">
      <div className="mx-auto max-w-2xl">
        <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-white p-1" role="tablist" aria-label="Notifications and activity">
          {(['inbox', 'activity', 'settings'] as const).map((key) => (
            <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)} className={`min-h-10 rounded-full px-1 py-1 text-sm font-semibold leading-tight [overflow-wrap:anywhere] ${section === key ? 'bg-[#06152a] text-white' : 'text-ink-soft'}`}>
              {key === 'inbox' ? `Notifications${counts.unread ? ` (${counts.unread})` : ''}` : key === 'activity' ? 'Activity' : 'Settings'}
            </button>
          ))}
        </div>

        {section === 'inbox' && (
          <>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Filter">
              {TABS.map((item) => (
                <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={`chip shrink-0 ${tab === item.key ? 'chip-active' : ''}`}>
                  {item.label}
                  {badge(item.key) > 0 && <span className="rounded-full bg-clay-400 px-1.5 text-[0.6875rem] font-bold text-acacia-700">{badge(item.key)}</span>}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search notifications…" aria-label="Search notifications" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-[0.9375rem] outline-none focus:border-acacia-600" />
              <button type="button" onClick={() => mark(undefined)} className="h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold">Mark all read</button>
              {tab !== 'archived' && <button type="button" onClick={() => archive(undefined, true, true)} className="h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold">Clear read</button>}
            </div>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {items === null ? <li className="p-4 text-sm text-ink-muted">Loading…</li> : items.length === 0 ? (
                <li className="p-2"><EmptyState className="border-0 bg-transparent py-10" title={tab === 'archived' ? 'Nothing archived' : 'You are all caught up'} description="Messages, requests, invitations and updates appear here." /></li>
              ) : items.map((note) => (
                <li key={note.id} className={`flex gap-3 px-4 py-3 ${note.read ? '' : 'bg-[#fffaf0]'}`}>
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06152a] text-base" aria-hidden>{ICON[note.category] ?? '🔔'}</span>
                  <button type="button" onClick={() => open(note)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-start justify-between gap-2">
                      <span className={`text-[0.9375rem] ${note.read ? 'text-ink' : 'font-bold text-ink'}`}>{note.title}</span>
                      <span className="shrink-0 text-xs text-ink-muted">{ago(note.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-muted [overflow-wrap:anywhere]">{note.body}</span>
                  </button>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
                    {!note.read && <span className="h-2.5 w-2.5 rounded-full bg-clay-400" aria-label="Unread" />}
                    <button type="button" onClick={() => mark([note.id], !note.read)} className="inline-flex min-h-10 items-center px-1 text-ink-faint underline">{note.read ? 'Unread' : 'Read'}</button>
                    <button type="button" onClick={() => archive([note.id], !note.archived)} className="inline-flex min-h-10 items-center px-1 text-ink-faint underline">{note.archived ? 'Restore' : 'Archive'}</button>
                  </span>
                </li>
              ))}
            </ul>
            {hasMore && items && <button type="button" onClick={() => load(items[items.length - 1]!.createdAt)} className="mt-3 h-11 w-full rounded-full border border-line bg-white text-sm font-semibold">Show older</button>}
          </>
        )}

        {section === 'activity' && (
          <>
            <p className="mt-4 text-sm text-ink-muted">What you have done on Enhakkore. This is a history for you — your official bookings, payments and tournament entries are kept in their own sections.</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Activity filter">
              {ACTIVITY_FILTERS.map((item) => (
                <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`chip shrink-0 ${filter === item.key ? 'chip-active' : ''}`}>{item.label}</button>
              ))}
            </div>
            <ol className="mt-4 grid gap-2">
              {activity === null ? <li className="text-sm text-ink-muted">Loading…</li> : activity.length === 0 ? <li className="rounded-2xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink-soft">No activity yet.</li> : activity.map((item) => (
                <li key={item.id} className="rounded-xl border border-line bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-clay-600">{item.label}</p>
                  {item.link ? <Link href={item.link} className="font-semibold text-ink hover:underline">{item.title}</Link> : <p className="font-semibold text-ink">{item.title}</p>}
                  <p className="text-xs text-ink-muted">{new Date(item.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </li>
              ))}
            </ol>
          </>
        )}

        {section === 'settings' && <div className="mt-4"><NotificationSettings /></div>}
      </div>
    </DashboardShell>
  );
}
