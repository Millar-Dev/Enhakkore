'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { Button, ButtonLink } from '@/components/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this is where an error reporter would receive it.
    console.error('[web] unhandled error', error);
  }, [error]);

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
          <h1 className="text-h1 text-balance">Something went wrong on our side</h1>
          <p className="mx-auto mt-4 max-w-md text-[1rem] leading-relaxed text-ink-muted">
            This is not you. Try again — and if it keeps happening, tell us at{' '}
            <a href="mailto:support@enhakkore.com" className="font-semibold text-acacia-700 underline">
              support@enhakkore.com
            </a>
            .
          </p>

          {error.digest && (
            <p className="mt-4 font-mono text-[0.75rem] text-ink-faint">Reference: {error.digest}</p>
          )}

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Try again</Button>
            <ButtonLink href="/" variant="secondary">
              Back to home
            </ButtonLink>
          </div>
        </div>
      </main>
    </div>
  );
}
