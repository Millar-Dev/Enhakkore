import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { GroupDetail } from '@/components/gaming/Social';

export const metadata: Metadata = { title: 'Squad, guild or team' };

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PublicShell>
      <GroupDetail slug={slug} />
    </PublicShell>
  );
}
