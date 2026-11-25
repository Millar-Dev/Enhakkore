import Link from 'next/link';
import type { SiteSettings } from '@enhakkore/shared';
import { waHref, waNumbers } from '@/lib/site';
import { OriginalLogo, WscLogo } from './BrandLogo';
import { SocialIcon } from './SocialIcon';

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      { href: '/travel', label: 'Enhakkore Travel' },
      { href: '/discover', label: 'Discover places' },
      { href: '/experiences', label: 'Experiences' },
      { href: '/events', label: 'Events' },
      { href: '/catering', label: 'Catering & lunchboxes' },
      { href: '/destinations', label: 'Destinations' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: '/activities', label: 'Activities' },
      { href: '/activities/host', label: 'Host an activity' },
      { href: '/connect', label: 'Find your people' },
      { href: '/weekend', label: 'This weekend' },
      { href: '/community', label: 'Stories, polls & challenges' },
      { href: '/deals', label: 'Local deals' },
    ],
  },
  {
    title: 'Enhakkore',
    links: [
      { href: '/impact', label: 'Impact & WSC' },
      { href: '/donate', label: 'Donate' },
      { href: '/contact', label: 'Contact' },
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/safety', label: 'Community safety' },
    ],
  },
];

export function Footer({ settings }: { settings: SiteSettings }) {
  const numbers = waNumbers(settings);
  return (
    <footer className="border-t border-line bg-[color:var(--color-cream)]">
      <div className="shell py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <OriginalLogo src={settings.brand.logoUrl} height={104} />
            <p className="mt-5 font-display text-[1.35rem] text-acacia-700">{settings.brand.slogan}</p>
            <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">{settings.brand.description}</p>

            <div className="mt-7 grid gap-2.5">
              {numbers.map((number, index) => (
                <a
                  key={number.digits}
                  href={waHref(settings, 'general', null, index)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex w-fit items-center gap-2.5 rounded-full border border-line-strong bg-white px-4 py-2 text-[0.9375rem] font-semibold text-acacia-700 transition hover:border-acacia-600"
                >
                  <span className="text-[#1f9d55]">
                    <SocialIcon platform="whatsapp" size={18} />
                  </span>
                  {number.display}
                  <span className="text-xs font-normal text-ink-muted">{number.label}</span>
                </a>
              ))}
              {settings.contact.emails.map((email) => (
                <a key={email.address} href={`mailto:${email.address}`} className="text-[0.9375rem] font-medium text-ink-soft hover:text-acacia-600">
                  {email.address}
                </a>
              ))}
              {settings.contact.address && <p className="text-[0.9375rem] text-ink-muted">{settings.contact.address}</p>}
            </div>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Social media">
              {settings.social.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-full bg-acacia-600 px-3.5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-acacia-500"
                  >
                    <SocialIcon platform={link.platform} size={15} />
                    {link.handle || link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="kicker">{column.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-[0.9375rem] text-ink-soft transition-colors hover:text-acacia-600">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-line pt-7 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <WscLogo src={settings.brand.wscLogoUrl} height={34} />
            <p className="max-w-md text-[0.8125rem] leading-relaxed text-ink-muted">
              Our impact work is carried out together with WSC — We Save Children, an independent charity group.
            </p>
          </div>
          <p className="text-[0.8125rem] text-ink-muted">
            © {new Date().getFullYear()} {settings.brand.name}. Enquiries and applications are confirmed by our team — they are not instant bookings.
          </p>
        </div>
      </div>
    </footer>
  );
}
