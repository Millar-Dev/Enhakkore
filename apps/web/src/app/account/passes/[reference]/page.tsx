'use client';

import Link from 'next/link';
import { use } from 'react';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { PassCard, type PassView } from '@/components/public/PassCard';
import { useApi } from '@/lib/useApi';

export default function PassPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const { data, error } = useApi<PassView>(`/passes/mine/${encodeURIComponent(reference)}`);
  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Your pass">
      <Link href="/account/passes" className="text-sm font-semibold text-acacia-700">‹ All passes</Link>
      <div className="mx-auto mt-4 max-w-sm">
        {error && <p className="text-sm text-[#b42318]">{error}</p>}
        {data ? <PassCard pass={data} large /> : !error && <p className="text-sm text-ink-muted">Loading…</p>}
        <p className="mt-4 text-center text-xs text-ink-muted">Turn your screen brightness up at the entrance. The code holds no personal details.</p>
      </div>
    </DashboardShell>
  );
}
