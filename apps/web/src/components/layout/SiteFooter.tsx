import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/brand/Logo';
import { PARTNER } from '@/components/brand/Partner';
import { Icon } from '@/components/ui';
import { CONTACT } from '@/content/contact';

const COLUMNS = [
  {
    title: 'Travel',
    links: [
      { href: '/trips', label: 'Explore trips' },
      { href: '/safari', label: 'Safari' },
      { href: '/trips?type=GROUP', label: 'Group trips' },
      { href: '/private-trips', label: 'Private & custom' },
      { href: '/trips?type=INTERNATIONAL', label: 'International' },
    ],
  },
  {
    title: 'Impact',
    links: [
      { href: '/impact', label: 'All projects' },
      { href: '/impact?category=EDUCATION', label: 'Education' },
      { href: '/impact?category=HEALTHCARE', label: 'Healthcare' },
      { href: '/impact?category=CLEAN_WATER', label: 'Clean water' },
      { href: '/impact/dashboard', label: 'Impact dashboard' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/community', label: 'Community' },
      { href: '/operators', label: 'For tour operators' },
      { href: '/trust', label: 'Trust & safety' },
    ],
  },
];

/** Instagram's glyph, drawn rather than imported. */
function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-sand/60">
      <div className="shell py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo size="lg" withDescriptor />
            <p className="mt-6 max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">
              A travel platform where people discover experiences, join other travellers, build real
              connections, and have the chance to create positive impact through their journeys.
            </p>
            <p className="mt-6 text-[1.0625rem] font-semibold tracking-tight text-acacia-700">
              Travel together. Experience more. Give back.
            </p>

            {/* Reach us. Phone first — it is how most people here get in touch. */}
            <div className="mt-8 flex flex-col gap-2.5">
              {CONTACT.phones
                .filter((phone) => phone.primary)
                .map((phone) => (
                  <a
                    key={phone.dial}
                    href={`tel:${phone.dial}`}
                    className="group inline-flex w-fit items-center gap-2.5 text-[0.9375rem] text-ink transition-colors hover:text-acacia-700"
                  >
                    <Icon.chat size={15} className="text-ink-faint" />
                    <span className="font-mono tracking-[0.02em]">{phone.display}</span>
                    <span className="text-[0.75rem] text-ink-faint">{phone.label}</span>
                  </a>
                ))}

              <a
                href={`mailto:${CONTACT.email}`}
                className="inline-flex w-fit items-center gap-2.5 text-[0.9375rem] text-ink transition-colors hover:text-acacia-700"
              >
                <Icon.user size={15} className="text-ink-faint" />
                {CONTACT.email}
              </a>
            </div>

            {/* Instagram. Ours, and WSC's named as theirs. */}
            <div className="mt-7">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Follow
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {CONTACT.social.map((account) => (
                  <li key={account.href}>
                    <a
                      href={account.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-line-strong bg-white px-3.5 py-2 text-[0.8125rem] font-medium text-ink transition-colors hover:border-ink"
                    >
                      <InstagramGlyph />
                      {account.handle}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href={CONTACT.partnerSocial.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-dashed border-line-strong px-3.5 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:border-ink hover:text-ink"
                  >
                    <InstagramGlyph />
                    {CONTACT.partnerSocial.handle}
                    <span className="text-[0.6875rem] text-ink-faint">WSC</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-eyebrow uppercase text-ink-muted">{column.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[0.875rem] text-ink-soft transition-colors hover:text-acacia-700"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Honesty note. This stays until the platform is genuinely live. */}
        <div className="mt-14 flex flex-wrap items-center gap-5 border-t border-line pt-8">
          <Image
            src={PARTNER.logo}
            alt={`${PARTNER.fullName} logo`}
            width={104}
            height={59}
            loading="lazy"
            className="h-[38px] w-auto"
          />
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink">
            <span className="font-semibold">No child should grow up in poverty.</span> Every trip we run
            helps us get back out to communities like Hoyoyo — and anyone can add to that.{' '}
            <Link href="/impact" className="font-semibold text-acacia-700 underline underline-offset-2">
              Give to the work
            </Link>
            .
          </p>
        </div>

        <div className="mt-14 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-white/70 p-5">
          <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">Payments are not taken on this website.</span> Trips are
            booked by enquiry and paid directly to the organiser, who confirms your place once the payment
            has been checked. The operator marketplace is not open yet — every trip listed here is one we run
            ourselves.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-8 text-[0.8125rem] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Enhakkore. Built in Tanzania.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/legal/terms" className="transition-colors hover:text-ink">
              Terms
            </Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link href="/trust" className="transition-colors hover:text-ink">
              Trust &amp; safety
            </Link>
            <Link href="/contact" className="transition-colors hover:text-ink">
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
