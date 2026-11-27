import Link from 'next/link';
import type { SiteSettings } from '@enhakkore/shared';
import { StayConnected } from '@/components/public/StayConnected';
import { waHref, waNumbers } from '@/lib/site';
import { WscLogo } from './BrandLogo';
import { SocialIcon } from './SocialIcon';

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      { href: '/experiences', label: 'Experiences' },
      { href: '/travel', label: 'Travel & trips' },
      { href: '/explore', label: 'Discover places' },
      { href: '/explore?section=FOOD', label: 'Food & dining' },
      { href: '/destinations', label: 'Destinations' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: '/experiences/communities', label: 'Communities' },
      { href: '/experiences#upcoming', label: 'Events' },
      { href: '/experiences/c/sports', label: 'Sports' },
      { href: '/experiences/gaming', label: 'Gaming' },
      { href: '/experiences/publish', label: 'Publish an activity' },
    ],
  },
  {
    title: 'Impact',
    links: [
      { href: '/impact', label: 'WSC — We Save Children' },
      { href: '/impact#projects', label: 'Our projects' },
      { href: '/impact#volunteer', label: 'Get involved' },
      { href: '/donate', label: 'Donate' },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: '/contact', label: 'Contact us' },
      { href: '/faq', label: 'Help & FAQs' },
      { href: '/partner', label: 'Partner with us' },
      { href: '/about', label: 'About Enhakkore' },
      { href: '/legal', label: 'Privacy & terms' },
    ],
  },
];

/**
 * The site footer: deep navy with a gold rule, the original logo prepared for
 * dark backgrounds, four link groups, a sign-up for updates and the WhatsApp
 * numbers. On phones the link groups fold open so the footer stays short.
 */
export function Footer({ settings }: { settings: SiteSettings }) {
  const numbers = waNumbers(settings);
  return (
    <footer className="site-footer">
      <div className="shell py-10 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_2.6fr_1.3fr] lg:gap-10">
          <div className="text-center lg:text-left">
            <Link href="/" aria-label="Enhakkore Travel & Impact — home" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/refined/enhakkore-logo-on-dark.png" alt="Enhakkore Travel & Impact" width={180} height={143} className="mx-auto h-28 w-auto lg:mx-0 lg:h-32" />
            </Link>
            <p className="mt-3 text-sm font-semibold text-clay-400">Explore · Connect · Create Impact</p>
            <ul className="mt-4 flex justify-center gap-2 lg:justify-start" aria-label="Social media">
              {settings.social.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer noopener" aria-label={link.handle || link.label} title={link.handle || link.label} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white hover:border-clay-400 hover:text-clay-400">
                    <SocialIcon platform={link.platform} size={18} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Link groups: columns on larger screens, folding groups on phones. */}
          <div>
            <div className="hidden grid-cols-4 gap-6 sm:grid">
              {COLUMNS.map((column) => (
                <div key={column.title}>
                  <p className="text-sm font-bold text-white">{column.title}</p>
                  <ul className="mt-3 space-y-1">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="inline-flex min-h-9 items-center text-[0.875rem] text-white/70 transition-colors hover:text-clay-400">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10 sm:hidden">
              {COLUMNS.map((column) => (
                <details key={column.title} className="group">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[0.9375rem] font-semibold [&::-webkit-details-marker]:hidden">
                    {column.title}
                    <span className="text-clay-400 transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <ul className="grid grid-cols-2 gap-x-4 pb-3">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="flex min-h-10 items-center text-[0.875rem] text-white/75 hover:text-clay-400">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-white">Stay connected</p>
            <p className="mt-1 text-[0.8125rem] text-white/65">Get updates on trips, events and impact stories.</p>
            <StayConnected />
            <div className="mt-4 grid gap-1.5">
              {numbers.map((number, index) => (
                <a key={number.digits} href={waHref(settings, 'general', null, index)} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-10 w-fit max-w-full items-center gap-2 text-[0.875rem] font-semibold text-white/85 hover:text-clay-400">
                  <span className="text-[#25d366]"><SocialIcon platform="whatsapp" size={17} /></span>
                  {number.display}
                  <span className="truncate text-xs font-normal text-white/50">{number.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-[0.8125rem] text-white/55 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="shrink-0 rounded-lg bg-white p-1"><WscLogo src={settings.brand.wscLogoUrl} height={26} /></span>
            <p>WSC — We Save Children is part of Enhakkore Impact.</p>
          </div>
          <p>© {new Date().getFullYear()} {settings.brand.name}. Enquiries are confirmed by our team — they are not instant bookings.</p>
        </div>
      </div>
    </footer>
  );
}
