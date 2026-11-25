import { PublicShell } from '@/components/layout/PublicShell';
import { RequestsClient } from '@/components/connect/ConnectClient';

export const metadata = { title: 'Connections' };

export default function RequestsPage() {
  return (
    <PublicShell>
      <section className="shell max-w-3xl py-10">
        <h1 className="display-md mb-6 text-acacia-700">Connections</h1>
        <RequestsClient />
      </section>
    </PublicShell>
  );
}
