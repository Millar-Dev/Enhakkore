'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { COUNTRIES, slugify } from '@enhakkore/shared';
import { LocationSelector } from '@/components/public/LocationSelector';
import { useSession } from '@/lib/session';

const STORE = 'enh.location';
const titleCase = (slug: string) => slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

/**
 * "Discovering in Dar es Salaam, Tanzania · Change". The place comes from the
 * last choice on this device, else the member's account, else nowhere in
 * particular. GPS is never required.
 */
export function DiscoveringBar({ tone }: { tone: 'navy' | 'ivory' }) {
  const { user } = useSession();
  const [place, setPlace] = useState<{ country: string; city: string | null } | null>(null);

  useEffect(() => {
    let saved: { country?: string; city?: string | null } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    } catch {
      saved = null;
    }
    if (saved) return setPlace(saved.country ? { country: saved.country, city: saved.city ?? null } : null);
    if (user?.country) {
      const code = COUNTRIES.find((item) => item.name === user.country || item.code === user.country)?.code;
      if (code) setPlace({ country: code, city: user.city ? slugify(user.city) : null });
    }
  }, [user?.country, user?.city]);

  const country = place ? COUNTRIES.find((item) => item.code === place.country) : null;
  const label = country ? [place?.city ? titleCase(place.city) : null, country.name].filter(Boolean).join(', ') : 'Anywhere';
  const query = place ? `?country=${place.country}${place.city ? `&city=${place.city}` : ''}` : '';
  const dark = tone === 'navy';
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border px-4 py-2.5 text-sm ${dark ? 'border-white/10 bg-white/[0.04] text-white/80' : 'border-line bg-white text-ink-soft'}`}>
      <span aria-hidden>📍</span>
      <span>Discovering in <strong className={dark ? 'text-white' : 'text-ink'}>{label}</strong></span>
      <LocationSelector
        tone={dark ? 'dark' : 'light'}
        compact
        triggerLabel="Change"
        autoDefault={false}
        country={place?.country}
        city={place?.city ?? undefined}
        onChoose={(code, citySlug) => setPlace(code ? { country: code, city: citySlug } : null)}
      />
      {place && (
        <span className="ml-auto flex gap-3 text-xs font-semibold">
          <Link href={`/experiences${query}`} className={dark ? 'text-clay-400' : 'text-acacia-700'}>Experiences here</Link>
          <Link href={`/explore${query}`} className={dark ? 'text-clay-400' : 'text-acacia-700'}>Places here</Link>
        </span>
      )}
    </div>
  );
}
