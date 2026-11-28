import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { SessionDetail } from '@/components/gaming/Social';

export const metadata: Metadata = { title: 'Gaming session' };

export default async function SessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PublicShell>
      <SessionDetail slug={slug} />
    </PublicShell>
  );
}
