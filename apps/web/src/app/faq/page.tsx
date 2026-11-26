import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { PageHero } from '@/components/public/Cards';

export const metadata: Metadata = { title: 'Frequently asked questions' };

const FAQS: { q: string; a: React.ReactNode }[] = [
  { q: 'Is joining Enhakkore free?', a: 'Yes. A member account, browsing, joining communities, free activities and gaming tournaments, and sending enquiries are all free.' },
  { q: 'Is an enquiry or reservation request a booking?', a: 'No. Hotel enquiries and restaurant reservation requests are requests. A room or table is confirmed only when the property accepts it, and we pass that on to you. You can follow every request under My account → Enquiries.' },
  { q: 'How do I join a trip?', a: <>Open the trip under <Link href="/travel" className="underline">Travel</Link> and apply. The team reviews your application, confirms your payment, and then you get access to that departure’s private group chat.</> },
  { q: 'Can I publish my own activity?', a: <>Yes — <Link href="/experiences/publish" className="underline">publish an event or activity</Link>. Every submission is reviewed before it goes live. Large or paid events need enhanced review.</> },
  { q: 'Do gaming tournaments cost money?', a: 'Not at launch. Every tournament is free to enter.' },
  { q: 'Can my business be listed?', a: <>Apply on <Link href="/partner" className="underline">Partner with us</Link>. Businesses cannot publish themselves: our team verifies and publishes every listing. Sponsored listings are always labelled.</> },
  { q: 'How do donations work?', a: <>See the <Link href="/donate" className="underline">donate page</Link>. Donations go to community projects with WSC and are kept separate from Enhakkore’s business income.</> },
  { q: 'How is my information protected?', a: <>Your phone number, email and registrations are never shown publicly. Read the <Link href="/legal/privacy" className="underline">privacy policy</Link>.</> },
];

export default function FaqPage() {
  return (
    <PublicShell>
      <PageHero kicker="Help" title="Frequently asked questions" intro="Something else? Message us on WhatsApp — the numbers are on the contact page." />
      <section className="shell max-w-3xl py-10">
        <div className="divide-y divide-line rounded-[1.2rem] border border-line bg-white">
          {FAQS.map((item) => (
            <details key={item.q} className="group p-5">
              <summary className="cursor-pointer list-none font-semibold text-acacia-700">{item.q}</summary>
              <div className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{item.a}</div>
            </details>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
