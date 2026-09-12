import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { Alert, Eyebrow } from '@/components/ui';

/**
 * Legal placeholders.
 *
 * These are deliberately not drafted as real terms. Writing convincing-looking
 * legal text that has not been through a lawyer is worse than saying plainly
 * that it is outstanding — so that is what these pages do.
 */

const DOCS: Record<string, { title: string; intro: string; outline: string[] }> = {
  terms: {
    title: 'Terms of service',
    intro:
      'The agreement between travellers, tour operators and Enhakkore — what each party is responsible for, and what happens when something goes wrong.',
    outline: [
      'Who Enhakkore is and what the platform does (a marketplace, not the operator of your trip)',
      'Traveller accounts, eligibility and acceptable use',
      'Booking, payment, and what a confirmed booking actually commits you to',
      'Cancellation, changes and refunds — including that operators set their own trip policies',
      'Operator obligations: licensing, insurance, duty of care and accurate listings',
      'Commission, payouts and the timing of both',
      'Impact contributions: what they are, what they are not, and that they are non-refundable once disbursed',
      'Reviews, trip groups and conduct',
      'Liability, and the limits of a marketplace’s responsibility for a third party’s trip',
      'Dispute resolution and governing law',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    intro:
      'What personal data Enhakkore collects, why, who it is shared with, and the control you have over it.',
    outline: [
      'What we collect: account details, booking details, traveller names, messages, contribution history',
      'Why we collect each of those, and the lawful basis for it',
      'What your fellow travellers can see (name, photo, country — nothing else)',
      'What the operator running your trip receives, and when',
      'Payment data: handled by the payment provider, never stored by Enhakkore',
      'How long data is kept, and what happens when you close your account',
      'Your rights: access, correction, export and deletion',
      'Cookies and analytics',
      'International transfers, given travellers and operators across several countries',
      'How to contact us or complain to a regulator',
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const entry = DOCS[doc];
  return entry ? { title: entry.title } : { title: 'Not found' };
}

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = DOCS[doc];
  if (!entry) notFound();

  return (
    <PublicShell>
      <div className="shell-narrow py-14 md:py-20">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="mt-4 text-h1">{entry.title}</h1>
        <p className="mt-4 text-[1rem] leading-relaxed text-ink-muted">{entry.intro}</p>

        <Alert tone="neutral" className="mt-8" title="Not yet drafted">
          Enhakkore is a pre-launch build and this document has not been written or reviewed by a lawyer.
          Rather than publish plausible-looking legal text that nobody has checked, this page sets out what
          the finished document will cover. It will be replaced with real, reviewed terms before the
          platform takes a live booking.
        </Alert>

        <h2 className="mt-12 text-h3">What this document will cover</h2>
        <ol className="mt-6 space-y-4">
          {entry.outline.map((item, index) => (
            <li key={item} className="flex gap-4 text-[0.9375rem] leading-relaxed text-ink-soft">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand text-[0.75rem] font-bold text-ink-muted">
                {index + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>

        <div className="mt-12 border-t border-line pt-8">
          <p className="text-[0.9375rem] text-ink-muted">
            In the meantime,{' '}
            <Link href="/trust" className="font-semibold text-acacia-700 hover:underline">
              Trust &amp; safety
            </Link>{' '}
            describes in plain language how verification, reviews, privacy and payments actually work on
            the platform today. Questions to{' '}
            <a href="mailto:hello@enhakkore.com" className="font-semibold text-acacia-700 hover:underline">
              hello@enhakkore.com
            </a>
            .
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
