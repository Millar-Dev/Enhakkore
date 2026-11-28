'use client';

import { useEffect, useState } from 'react';
import type { CommunityCard } from '@/components/home/types';
import { CardGrid, SectionTitle } from '@/components/public/Cards';
import { CommunityTile } from '@/components/public/experience';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** For signed-in members: communities matching their interests and city, first. */
export function RecommendedCommunities({ kind = 'COMMUNITY' }: { kind?: 'COMMUNITY' | 'STUDY_GROUP' }) {
  const { status } = useSession();
  const [items, setItems] = useState<(CommunityCard & { recommended?: boolean })[]>([]);
  useEffect(() => {
    if (status !== 'authenticated') return;
    api.get<{ items: (CommunityCard & { recommended?: boolean })[] }>(`/public/communities?kind=${kind}`).then((data) => setItems(data.items.filter((item) => item.recommended).slice(0, 6))).catch(() => setItems([]));
  }, [status, kind]);
  if (!items.length) return null;
  return (
    <div className="mb-10">
      <SectionTitle kicker="For you" title="Recommended for you" subtitle="Based on your interests and city. Change them on your profile." />
      <CardGrid>{items.map((community) => <CommunityTile key={community.id} community={community} />)}</CardGrid>
    </div>
  );
}
