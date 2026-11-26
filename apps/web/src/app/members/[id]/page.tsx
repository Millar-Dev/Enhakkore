import { PublicShell } from '@/components/layout/PublicShell';
import { MemberProfile } from '@/components/connect/MemberProfile';

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PublicShell>
      <section className="shell max-w-3xl py-10"><MemberProfile id={id} /></section>
    </PublicShell>
  );
}
