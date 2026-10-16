import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/brand/Logo';
import { PARTNER } from '@/components/brand/Partner';

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
          <p className="max-w-md text-[0.8125rem] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">Our social-impact partner.</span> We Save Children works
            so that no child grows up in poverty. Enhakkore runs the travel;{' '}
            <Link href="/impact" className="underline underline-offset-2 hover:text-ink">
              see the work
            </Link>
            .
          </p>
        </div>

        <div className="mt-14 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-white/70 p-5">
          <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">This is a pre-launch build.</span> Trips, operators,
            impact projects, contribution totals and reviews shown here are demonstration content created for
            development and design review. No payment provider is connected, no organisation has been
            verified, and no figure on this site represents money raised or work completed.
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
