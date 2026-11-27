'use client';

import Link from 'next/link';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { PassCard, type PassView } from '@/components/public/PassCard';
import { useApi } from '@/lib/useApi';

/** The member's Enhakkore Passes: confirmed entries to controlled events, trips and reservations. */
export default function PassesPage() {
  const { data, error } = useApi<{ items: PassView[] }>('/passes/mine');
  const active = data?.items.filter((pass) => pass.status === 'VALID' || pass.status === 'CHECKED_IN') ?? [];
  const past = data?.items.filter((pass) => !active.includes(pass)) ?? [];
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Enhakkore Pass">
      <p className="max-w-2xl text-sm text-ink-muted">
        A pass appears here when entry is controlled and your place is confirmed: paid or checked events, activities whose organiser uses check-in, confirmed trips and accepted hotel or restaurant reservations. Ordinary free activities do not need one.
      </p>
      {error && <p className="mt-4 text-sm text-[#b42318]">{error}</p>}
      {!data && !error && <p className="mt-6 text-sm text-ink-muted">Loading…</p>}
      {data && data.items.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-soft">
          You have no passes yet. <Link href="/experiences" className="font-semibold text-acacia-700 underline">Find an experience</Link> or <Link href="/travel" className="font-semibold text-acacia-700 underline">see upcoming trips</Link>.
        </div>
      )}
      {active.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((pass) => (
            <li key={pass.id}>
              <Link href={`/account/passes/${pass.reference}`} className="block h-full" aria-label={`Open pass ${pass.reference}`}>
                <PassCard pass={pass} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-muted">Past and cancelled</h2>
          <ul className="mt-3 grid gap-4 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((pass) => <li key={pass.id}><PassCard pass={pass} /></li>)}
          </ul>
        </section>
      )}
    </DashboardShell>
  );
}
