import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL_GROUPS, LEGAL_PAGES, LEGAL_VERSION } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { getSite } from '@/lib/site';

export const metadata: Metadata = { title: 'Policy Centre' };

export default async function PolicyCentre() {
  const { settings } = await getSite();
  return (
    <PublicShell>
      <section className="bg-acacia-700 text-white">
        <div className="shell max-w-4xl py-7 md:py-10">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.2em] text-clay-400">Policy Centre</p>
          <h1 className="mt-1 font-display text-[2rem] md:text-[2.6rem]">How Enhakkore works, in writing</h1>
          <p className="mt-2 text-sm text-white/75">Version {LEGAL_VERSION}.{settings.legal.reviewed ? '' : ' These are plain-language drafts. They have not yet been reviewed by a lawyer and are awaiting review under the laws of Tanzania and any other country where Enhakkore operates.'}</p>
        </div>
      </section>
      <section className="shell max-w-4xl py-6 md:py-10">
        <div className="grid gap-6 md:grid-cols-2">
          {LEGAL_GROUPS.map((group) => (
            <div key={group}>
              <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-clay-600">{group}</h2>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
                {LEGAL_PAGES.filter((page) => page.group === group).map((page) => (
                  <li key={page.key}>
                    <Link href={`/legal/${page.key}`} className="flex items-center justify-between px-4 py-3 text-[0.9375rem] font-semibold text-acacia-700 hover:bg-sand">
                      {page.title}
                      <span aria-hidden className="text-clay-500">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
