'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { SmartImage } from '@/components/public/SmartImage';
import { api } from '@/lib/api';

interface Saved {
  itemType: string;
  itemId: string;
  title: string;
  href: string;
  image: string | null;
}

/** The travel wishlist: places, trips, events, activities and destinations saved for later. */
export default function WishlistPage() {
  const [items, setItems] = useState<Saved[] | null>(null);
  const load = () => api.get<Saved[]>('/community/saved').then(setItems).catch(() => setItems([]));
  useEffect(() => {
    void load();
  }, []);
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Wishlist">
      {items === null ? <p className="text-ink-muted">Loading…</p> : items.length === 0 ? (
        <div className="rounded-xl bg-[color:var(--color-cream)] p-8 text-center">
          <p className="font-display text-2xl text-acacia-700">Nothing saved yet</p>
          <p className="mt-2 text-sm text-ink-soft">Tap “Save to wishlist” on any trip, place, event or activity.</p>
          <Link href="/explore" className="mt-4 inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Start discovering</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={`${item.itemType}-${item.itemId}`} className="overflow-hidden rounded-xl border border-line bg-white">
              <Link href={item.href}>
                <div className="relative aspect-[16/10] bg-[color:var(--color-cream-deep)]">{item.image && <SmartImage src={item.image} alt="" fill sizes="33vw" className="object-cover" />}</div>
                <div className="p-4">
                  <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-clay-600">{item.itemType.toLowerCase()}</p>
                  <p className="font-display text-xl text-acacia-700">{item.title}</p>
                </div>
              </Link>
              <button onClick={async () => { await api.post('/community/saved', { itemType: item.itemType, itemId: item.itemId }); void load(); }} className="mx-4 mb-4 text-xs font-semibold text-ink-muted underline">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
