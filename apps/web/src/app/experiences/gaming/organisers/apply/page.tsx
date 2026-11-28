import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { EsportsApplyForm } from '@/components/gaming/Social';

export const metadata: Metadata = { title: 'Register as an Esports Organiser' };

export default function EsportsApplyPage() {
  return (
    <PublicShell>
      <EsportsApplyForm />
    </PublicShell>
  );
}
