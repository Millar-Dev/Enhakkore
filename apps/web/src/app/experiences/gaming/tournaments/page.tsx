import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { TournamentDiscover } from '@/components/gaming/Tournaments';

export const metadata: Metadata = { title: 'Gaming tournaments', description: 'Friendly, guild, esports and creator tournaments on Enhakkore. Free to enter.' };

export default function TournamentsPage() {
  return (
    <PublicShell>
      <TournamentDiscover />
    </PublicShell>
  );
}
