import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { AppHero } from '@/components/public/AppHero';
import { HostHub } from '@/components/public/HostHub';
import { getSite } from '@/lib/site';

export const metadata: Metadata = { title: 'Host & Organise', description: 'Become an approved organiser and publish experiences on Enhakkore.' };

export default async function HostPage() {
  const { settings } = await getSite();
  return (
    <PublicShell>
      <AppHero title="Host & Organise" subtitle="Run events, sports sessions, tournaments and meetups — reviewed and supported by the Enhakkore team" image={settings.pages.experiencesHeroImage} />
      <section className="band band-ivory">
        <div className="shell py-8 md:py-12">
          <HostHub />
        </div>
      </section>
    </PublicShell>
  );
}
