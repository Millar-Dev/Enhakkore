import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { NiaChat } from '@/components/nia/NiaChat';

export const metadata: Metadata = { title: 'Nia — your Enhakkore assistant', description: 'Ask Nia to find places, experiences, trips, communities, study groups and gaming on Enhakkore.' };

export default function NiaPage() {
  return (
    <PublicShell footer={false}>
      <NiaChat />
    </PublicShell>
  );
}
