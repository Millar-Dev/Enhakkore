import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { NewGroupForm } from '@/components/public/NewStudyGroupForm';

export const metadata: Metadata = { title: 'Create a community' };

export default function NewCommunityPage() {
  return (
    <PublicShell>
      <NewGroupForm kind="COMMUNITY" />
    </PublicShell>
  );
}
