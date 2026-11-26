import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL_PAGES } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { getSite } from '@/lib/site';

export const metadata: Metadata = { title: 'Policies' };

export default async function LegalIndex() {
  const { settings } = await getSite();
  return (
    <PublicShell>
      <section className="shell max-w-3xl py-14">
        <p className="kicker">Policies</p>
        <h1 className="display-md mt-3 text-acacia-700">How Enhakkore works, in writing</h1>
        {!settings.legal.reviewed && (
          <p className="mt-5 text-[0.9375rem] text-ink-muted">These are plain-language drafts that have not yet been reviewed by a lawyer.</p>
        )}
        <ul className="mt-8 grid gap-2 sm:grid-cols-2">
          {LEGAL_PAGES.map((page) => (
            <li key={page.key}>
              <Link href={`/legal/${page.key}`} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3.5 font-semibold text-acacia-700 hover:border-acacia-600">
                {page.title}
                <span aria-hidden className="text-clay-500">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PublicShell>
  );
}
