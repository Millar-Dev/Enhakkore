import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { CreateTournamentForm } from '@/components/gaming/Tournaments';

export const metadata: Metadata = { title: 'Create a tournament' };

export default function NewTournamentPage() {
  return (
    <PublicShell>
      <CreateTournamentForm />
    </PublicShell>
  );
}
