import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { PageHero } from '@/components/public/Cards';
import { ConnectClient } from '@/components/connect/ConnectClient';

export const metadata: Metadata = { title: 'Connect', description: 'Find people who share your interests — in your city and around the world.' };

export default function ConnectPage() {
  return (
    <PublicShell>
      <PageHero kicker="Enhakkore Connect" title="Find your people" intro="Meet others who love what you love — basketball, running, gaming, travel, food — by country, city and interest. Anyone can join." />
      <section className="shell py-10"><ConnectClient /></section>
    </PublicShell>
  );
}
