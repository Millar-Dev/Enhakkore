import type { Metadata } from 'next';
import { PublicShell } from '@/components/layout/PublicShell';
import { PageHero } from '@/components/public/Cards';
import { EventPlanForm } from '@/components/public/EventPlanForm';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Plan an event', description: 'Tell Enhakkore about your event — we can help with the venue, catering, decoration, photography and more.' };

export default async function PlanPage() {
  const { settings } = await getSite();
  return (
    <PublicShell>
      <PageHero kicker="Experiences · Plan an event" title="Let’s plan your event" intro="Birthdays, weddings, launches, team days — tell us what you have in mind. The team will contact you to discuss it and, if you wish, a quotation." />
      <section className="shell max-w-3xl py-10">
        <div className="rounded-[1.4rem] border border-line bg-white p-5 md:p-8">
          <EventPlanForm whatsappHref={waHref(settings, 'general')} />
        </div>
      </section>
    </PublicShell>
  );
}
