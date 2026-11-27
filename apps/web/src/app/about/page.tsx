import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/layout/PublicShell';
import { OriginalLogo, WscLogo } from '@/components/site/BrandLogo';
import { getSite } from '@/lib/site';

export const metadata: Metadata = { title: 'About Enhakkore' };

export default async function AboutPage() {
  const { settings } = await getSite();
  return (
    <PublicShell>
      <section className="shell max-w-3xl py-14">
        <OriginalLogo src={settings.brand.logoUrl} height={96} />
        <h1 className="display-md mt-8 text-acacia-700">{settings.brand.slogan}</h1>
        <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink-soft">{settings.brand.description}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            { href: '/explore', title: 'Explore', body: 'Stays, food, venues and places worth visiting.' },
            { href: '/experiences', title: 'Experiences', body: 'Events, activities, communities and gaming.' },
            { href: '/travel', title: 'Travel', body: 'Group and private trips, travelling together.' },
            { href: '/impact', title: 'Impact', body: 'Enhakkore Impact, including WSC — We Save Children.' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="card-lift rounded-[1.1rem] border border-line bg-white p-5">
              <p className="font-display text-xl text-acacia-700">{item.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{item.body}</p>
            </Link>
          ))}
        </div>
        <div className="mt-10 flex items-center gap-4 rounded-[1.2rem] bg-[color:var(--color-cream)] p-5">
          <WscLogo src={settings.brand.wscLogoUrl} height={56} />
          <p className="text-sm leading-relaxed text-ink-soft">{settings.impact.wscIntro}</p>
        </div>
      </section>
    </PublicShell>
  );
}
