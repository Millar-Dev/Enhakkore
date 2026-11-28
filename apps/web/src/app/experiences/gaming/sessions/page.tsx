import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { SessionsBrowser } from '@/components/gaming/Social';

export const metadata: Metadata = { title: 'Gaming sessions', description: 'Casual matches, practice, training and gaming meet-ups.' };

export default function SessionsPage() {
  return (
    <PublicShell>
      <SessionsBrowser />
    </PublicShell>
  );
}
