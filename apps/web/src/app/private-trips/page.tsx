import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { PrivateTripsClient } from './PrivateTripsClient';

export const metadata: Metadata = { title: 'Private & custom trips', description: 'Tell us where you want to go and we will plan it with you.' };

export default function PrivateTripsPage() {
  return (
    <PublicShell>
      <PrivateTripsClient />
    </PublicShell>
  );
}
