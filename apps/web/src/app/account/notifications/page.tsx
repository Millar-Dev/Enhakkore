'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { api } from '@/lib/api';

interface Notice {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/** In-app notifications. Email and WhatsApp are sent only where those services are configured. */
export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[] | null>(null);
  useEffect(() => {
    api
      .get<{ items: Notice[] }>('/me/notifications')
      .then((data) => {
        setItems(data.items);
        if (data.items.some((item) => !item.read)) api.post('/me/notifications/read', {}).catch(() => undefined);
      })
      .catch(() => setItems([]));
  }, []);
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES}>
      <h1 className="font-display text-3xl text-acacia-700">Notifications</h1>
      {items === null ? (
        <p className="mt-4 text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-ink-soft">Nothing yet. You will see updates on registrations, enquiries, trips and communities here.</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {items.map((item) => {
            const body = (
              <>
                <p className={`font-semibold ${item.read ? 'text-ink' : 'text-acacia-700'}`}>{!item.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-clay-500" aria-label="New" />}{item.title}</p>
                <p className="text-sm text-ink-soft">{item.body}</p>
                <p className="mt-1 text-xs text-ink-muted">{new Date(item.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </>
            );
            return (
              <li key={item.id} className="rounded-xl border border-line bg-white p-4">
                {item.link ? <Link href={item.link}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
