import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/layout/PublicShell';
import { Prose } from '@/components/public/Cards';
import { getSite } from '@/lib/site';

/**
 * Terms, privacy, cancellation and safety — written by the owner in the
 * control centre (Settings → Legal). Until a page has been written it says so
 * plainly rather than showing invented legal text.
 */
const DOCS = {
  terms: 'Terms and conditions',
  privacy: 'Privacy policy',
  cancellation: 'Cancellation and refund policy',
  safety: 'Community safety',
} as const;

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc as keyof typeof DOCS] ?? 'Not found' };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!(doc in DOCS)) notFound();
  const { settings } = await getSite();
  const text = settings.legal[doc as keyof typeof DOCS];
  return (
    <PublicShell>
      <article className="shell max-w-3xl py-14">
        <p className="kicker">Legal</p>
        <h1 className="display-md mt-3 text-acacia-700">{DOCS[doc as keyof typeof DOCS]}</h1>
        {text ? (
          <Prose text={text} className="mt-8" />
        ) : (
          <p className="mt-8 rounded-xl bg-[#fdf8ec] p-5 text-ink-soft">
            This page has not been published yet. Until it is, please ask the Enhakkore team on WhatsApp about anything it would cover — trip-specific cancellation terms are shown on each trip.
          </p>
        )}
      </article>
    </PublicShell>
  );
}
