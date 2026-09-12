import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { SessionProvider } from '@/lib/session';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://enhakkore.com'),
  title: {
    default: 'Enhakkore — Travel & Impact',
    template: '%s · Enhakkore',
  },
  description:
    'Discover unforgettable journeys, connect with fellow travellers, and make a meaningful impact along the way. Travel together. Experience more. Give back.',
  keywords: [
    'Tanzania safari',
    'group travel',
    'Zanzibar',
    'Serengeti',
    'travel with purpose',
    'social impact travel',
  ],
  openGraph: {
    title: 'Enhakkore — Travel & Impact',
    description: 'Travel together. Experience more. Give back.',
    type: 'website',
    siteName: 'Enhakkore',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        {/* Keyboard users reach the content without walking the whole nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[--radius-field] focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
