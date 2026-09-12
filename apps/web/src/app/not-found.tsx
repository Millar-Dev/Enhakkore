import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { ButtonLink, Icon } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="shell flex h-16 items-center md:h-[4.5rem]">
          <Link href="/" aria-label="Enhakkore — home">
            <Logo size="md" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className="shell-narrow py-20 text-center">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-ink-muted">404</p>
          <h1 className="mt-4 text-h1 text-balance">This one is off the map</h1>
          <p className="mx-auto mt-4 max-w-md text-[1rem] leading-relaxed text-ink-muted">
            The page you were looking for does not exist. It may have moved, or the trip may no longer be
            listed.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/trips">
              Explore trips
              <Icon.arrow />
            </ButtonLink>
            <ButtonLink href="/" variant="secondary">
              Back to home
            </ButtonLink>
          </div>

          <nav className="mt-14 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.875rem]">
            {[
              { href: '/trips', label: 'Explore trips' },
              { href: '/safari', label: 'Safari' },
              { href: '/impact', label: 'Impact' },
              { href: '/private-trips', label: 'Private trips' },
              { href: '/how-it-works', label: 'How it works' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-ink-muted transition-colors hover:text-acacia-700"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}
