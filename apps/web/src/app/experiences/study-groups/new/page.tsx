import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { NewStudyGroupForm } from '@/components/public/NewStudyGroupForm';

export const metadata: Metadata = { title: 'Create a study group' };

export default function NewStudyGroupPage() {
  return (
    <PublicShell>
      <NewStudyGroupForm />
    </PublicShell>
  );
}
