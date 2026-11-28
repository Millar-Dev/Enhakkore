import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { GroupsBrowser } from '@/components/gaming/Social';

export const metadata: Metadata = { title: 'Squads, guilds & teams' };

export default function GroupsPage() {
  return (
    <PublicShell>
      <GroupsBrowser />
    </PublicShell>
  );
}
