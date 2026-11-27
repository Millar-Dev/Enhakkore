import Link from 'next/link';
import type { SiteSettings } from '@enhakkore/shared';
import { waHref, waNumbers } from '@/lib/site';
import { OriginalLogo, WscLogo } from './BrandLogo';
import { SocialIcon } from './SocialIcon';

const COLUMNS = [
  {
    title: 'Discover',
    links: [
      { href: '/explore', label: 'Explore places' },
      { href: '/experiences', label: 'Experiences' },
      { href: '/experiences/gaming', label: 'Gaming & esports' },
      { href: '/experiences/communities', label: 'Communities' },
      { href: '/travel', label: 'Travel' },
      { href: '/catering', label: 'Catering & lunchboxes' },
    ],
  },
  {
    title: 'Enhakkore',
    links: [
      { href: '/about', label: 'About Enhakkore' },
      { href: '/contact', label: 'Contact' },
      { href: '/faq', label: 'FAQs' },
      { href: '/partner', label: 'Partner with us' },
      { href: '/impact', label: 'WSC & impact' },
      { href: '/donate', label: 'Donate' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/terms', label: 'Terms and conditions' },
      { href: '/legal/community', label: 'Community guidelines' },
      { href: '/legal/cancellation', label: 'Cancellation & refunds' },
      { href: '/legal', label: 'Policy Centre' },
    ],
  },
];

export function Footer({ settings }: { settings: SiteSettings }) {
  const numbers = waNumbers(settings);
  return (
    <footer className="site-footer">
      <div className="shell py-12 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <span className="inline-block rounded-2xl bg-[#f6f2ea] p-2.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"><OriginalLogo src={settings.brand.logoUrl} height={96} /></span>
            <p className="mt-5 font-display text-[1.35rem] text-clay-400">{settings.brand.slogan}</p>
            <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-white/70">{settings.brand.description}</p>

            <div className="mt-7 grid gap-2.5">
              {numbers.map((number, index) => (
                <a
                  key={number.digits}
                  href={waHref(settings, 'general', null, index)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex w-fit max-w-full items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-[0.9375rem] font-semibold text-white transition hover:border-clay-400"
                >
                  <span className="text-[#1f9d55]">
                    <SocialIcon platform="whatsapp" size={18} />
                  </span>
                  {number.display}
                  <span className="truncate text-xs font-normal text-white/55">{number.label}</span>
                </a>
              ))}
              {settings.contact.emails.map((email) => (
                <a key={email.address} href={`mailto:${email.address}`} className="break-all text-[0.9375rem] font-medium text-white/80 hover:text-clay-400">
                  {email.address}
                </a>
              ))}
              {settings.contact.address && <p className="text-[0.9375rem] text-white/60">{settings.contact.address}</p>}
            </div>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Social media">
              {settings.social.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-full bg-clay-400 px-3.5 py-2 text-[0.8125rem] font-semibold text-acacia-700 transition hover:bg-clay-500 hover:text-white"
                  >
                    <SocialIcon platform={link.platform} size={15} />
                    {link.handle || link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 [&>*]:min-w-0">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="kicker">{column.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-[0.9375rem] text-white/75 transition-colors hover:text-clay-400">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-white/10 pt-7 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="shrink-0 rounded-lg bg-white p-1.5"><WscLogo src={settings.brand.wscLogoUrl} height={30} /></span>
            <p className="max-w-md text-[0.8125rem] leading-relaxed text-white/60">
              Our impact work is carried out together with WSC — We Save Children, an independent charity group.
            </p>
          </div>
          <p className="text-[0.8125rem] text-white/50">
            © {new Date().getFullYear()} {settings.brand.name}. Enquiries and applications are confirmed by our team — they are not instant bookings.
          </p>
        </div>
      </div>
    </footer>
  );
}
