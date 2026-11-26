import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google';
import { getSite } from '@/lib/site';
import { SessionProvider } from '@/lib/session';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  display: 'swap',
  weight: ['500', '600', '700'],
});

/** Title, description and icon come from the control centre (Settings → Brand and SEO). */
export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSite();
  return {
    metadataBase: new URL(process.env.SITE_URL ?? 'https://enhakkore-one.vercel.app'),
    title: { default: settings.seo.title, template: `%s · ${settings.brand.shortName}` },
    description: settings.seo.description,
    keywords: settings.seo.keywords,
    openGraph: {
      title: settings.seo.title,
      description: settings.seo.description,
      type: 'website',
      siteName: settings.brand.name,
      images: [{ url: settings.homepage.hero.imageUrl }],
    },
    icons: { icon: [{ url: settings.brand.faviconUrl }, { url: '/brand/refined/enhakkore-icon-192.png', sizes: '192x192' }], apple: '/brand/refined/enhakkore-icon-180.png' },
  };
}

export const viewport: Viewport = {
  themeColor: '#082b45',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${cormorant.variable}`}>
      <body>
        {/* Keyboard users reach the content without walking the whole nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius-field)] focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
