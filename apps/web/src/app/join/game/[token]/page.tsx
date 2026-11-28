import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { ExternalInviteLanding } from '@/components/gaming/Social';

export const metadata: Metadata = { title: 'You’ve been invited to play', robots: { index: false } };

export default async function ExternalInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <PublicShell>
      <ExternalInviteLanding token={token} />
    </PublicShell>
  );
}
