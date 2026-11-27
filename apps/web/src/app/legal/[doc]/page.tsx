import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LEGAL_PAGES, LEGAL_VERSION } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { Prose } from '@/components/public/Cards';
import { getSite } from '@/lib/site';

/**
 * The policy pages, written and edited by the owner in the control centre
 * (Settings → Legal & policies). They start as plain-language drafts and say
 * so until the owner confirms a lawyer has reviewed them.
 */
const find = (doc: string) => LEGAL_PAGES.find((page) => page.key === doc);

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: find(doc)?.title ?? 'Not found' };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const page = find(doc);
  if (!page) notFound();
  const { settings } = await getSite();
  const text = (settings.legal as unknown as Record<string, string>)[page.key];
  return (
    <PublicShell>
      <article className="shell max-w-3xl py-14">
        <Link href="/legal" className="kicker inline-flex min-h-10 items-center hover:text-acacia-600">Policy Centre · {page.group}</Link>
        <h1 className="display-md mt-3 text-acacia-700">{page.title}</h1>
        <p className="mt-2 text-xs text-ink-muted">Version {LEGAL_VERSION}</p>
        {!settings.legal.reviewed && (
          <p className="mt-6 rounded-xl border border-[#ecd9a8] bg-[#fdf8ec] p-4 text-[0.9375rem] text-ink-soft">
            <strong>Draft — awaiting legal review.</strong> This policy is a plain-language draft. It has not been reviewed by a lawyer and needs review under the laws of Tanzania and any other country where Enhakkore operates. If anything here matters to a decision you are making, please ask the Enhakkore team on WhatsApp.
          </p>
        )}
        {text ? (
          <Prose text={text} className="mt-8" />
        ) : (
          <p className="mt-8 rounded-xl bg-[#fdf8ec] p-5 text-ink-soft">This page has not been written yet. Please ask the Enhakkore team on WhatsApp about anything it would cover.</p>
        )}
      </article>
    </PublicShell>
  );
}
