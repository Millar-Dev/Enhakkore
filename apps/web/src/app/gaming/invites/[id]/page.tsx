import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { InvitePage } from '@/components/gaming/Social';

export const metadata: Metadata = { title: 'Gaming invitation', robots: { index: false } };

export default async function GamingInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PublicShell>
      <InvitePage id={id} />
    </PublicShell>
  );
}
