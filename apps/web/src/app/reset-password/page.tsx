import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Logo } from '@/components/brand/Logo';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Choose a new password',
  // The reset link's secret is in this page's address. `no-referrer` stops the
  // browser sending that address to any third party the page loads from
  // (fonts, images), and search engines are told not to index it.
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand/40 px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 inline-block">
          <Logo size="md" withDescriptor />
        </Link>
        <div className="rounded-[--radius-card] border border-line bg-white p-7 md:p-9">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
