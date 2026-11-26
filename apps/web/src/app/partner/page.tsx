import type { Metadata } from 'next';
import Link from 'next/link';
import { PARTNER_CATEGORIES } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { PageHero } from '@/components/public/Cards';
import { PartnerForm } from '@/components/public/PartnerForm';
import { SocialIcon } from '@/components/site/SocialIcon';
import { getSite, waNumbers } from '@/lib/site';

export const metadata: Metadata = { title: 'Partner with Enhakkore', description: 'Hotels, restaurants, venues, event organisers, gaming and sponsors — apply to be listed or to partner with Enhakkore.' };

export default async function PartnerPage() {
  const { settings } = await getSite();
  const numbers = waNumbers(settings);
  const message = encodeURIComponent('Hello Enhakkore, I represent a business and would like to talk about being listed or partnering with you. Business name: ');
  return (
    <PublicShell>
      <PageHero kicker="Partner with us" title="List with Enhakkore" intro="We feature businesses we can stand behind. Apply here or on WhatsApp — the team reviews and verifies every business, agrees the terms with you, and publishes the listing itself." />
      <section className="shell grid gap-10 py-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <div>
            <p className="font-display text-2xl text-acacia-700">Who we work with</p>
            <ul className="mt-3 flex flex-wrap gap-2">{PARTNER_CATEGORIES.map((category) => <li key={category} className="chip">{category}</li>)}</ul>
          </div>
          <div className="rounded-[1.2rem] border border-line bg-[color:var(--color-cream)] p-5 text-[0.9375rem] leading-relaxed text-ink-soft">
            <p className="font-bold text-acacia-700">How it works</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Businesses cannot publish themselves. Enhakkore decides what is featured.</li>
              <li><strong>Editorial</strong> listings are chosen by our team.</li>
              <li><strong>Sponsored</strong> placements are paid and always labelled “Sponsored”. They never change how other listings are ranked.</li>
              <li><strong>Referral and booking partnerships</strong> follow a commission agreed with you in writing.</li>
            </ul>
            <Link href="/legal/partners" className="mt-3 inline-block font-semibold text-acacia-600 underline">Partner agreements policy</Link>
          </div>
          <div className="rounded-[1.2rem] border border-line bg-white p-5">
            <p className="font-bold text-acacia-700">Option A — WhatsApp</p>
            <div className="mt-3 grid gap-2">
              {numbers.map((number) => (
                <a key={number.digits} href={`https://wa.me/${number.digits}?text=${message}`} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1f9d55] text-sm font-bold text-white">
                  <SocialIcon platform="whatsapp" size={18} /> {number.display}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-[1.4rem] border border-line bg-white p-5 md:p-8">
          <p className="font-display text-2xl text-acacia-700">Option B — Apply here</p>
          <div className="mt-4"><PartnerForm whatsappHref={numbers[0] ? `https://wa.me/${numbers[0].digits}?text=${message}` : '/contact'} /></div>
        </div>
      </section>
    </PublicShell>
  );
}
