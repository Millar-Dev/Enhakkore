import type { ReactNode } from 'react';
import Link from 'next/link';
import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { SocialIcon } from '@/components/site/SocialIcon';
import { getSite, waHref, waNumbers } from '@/lib/site';
import { MobileTabBar, MobileTabBarSpacer } from './MobileTabBar';

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Wrapper for every public page: announcement banner, header, footer and the
 * WhatsApp button. Contact numbers, navigation, logos and banners all come
 * from the control centre, read once per request.
 */
export async function PublicShell({
  children,
  footer = true,
}: {
  children: ReactNode;
  /** Kept for older pages; the header is always solid now. */
  transparentHeader?: boolean;
  footer?: boolean;
}) {
  const { settings, banners } = await getSite();
  const numbers = waNumbers(settings);
  const top = banners.filter((banner) => banner.placement === 'SITE_TOP').slice(0, 1);
  const overrides = [
    HEX.test(settings.brand.primaryColor) ? `--color-acacia-600:${settings.brand.primaryColor};` : '',
    HEX.test(settings.brand.accentColor) ? `--color-clay-400:${settings.brand.accentColor};` : '',
  ].join('');

  return (
    <div className="flex min-h-[100svh] w-full max-w-full flex-col overflow-x-clip bg-white">
      {overrides && <style>{`:root{${overrides}}`}</style>}
      {top.map((banner) => (
        <div
          key={banner.id}
          className={
            banner.tone === 'GOLD'
              ? 'bg-clay-400 text-acacia-700'
              : banner.tone === 'CREAM'
                ? 'border-b border-line bg-[color:var(--color-cream-deep)] text-acacia-700'
                : 'bg-acacia-600 text-white'
          }
        >
          <div className="shell flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-[0.8125rem] font-medium">
            <span>{banner.message}</span>
            {banner.linkUrl && (
              <Link href={banner.linkUrl} className="font-bold underline underline-offset-4">
                {banner.linkLabel || 'Find out more'}
              </Link>
            )}
          </div>
        </div>
      ))}
      <Header
        logoUrl={settings.brand.logoUrl}
        logoOnDarkUrl={settings.brand.logoOnDarkUrl}
        brandName={settings.brand.name}
        nav={settings.navigation.primary}
        hostHref="/activities/host"
        whatsapp={numbers.map((number, index) => ({ label: number.label, display: number.display, href: waHref(settings, 'general', null, index) }))}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      {footer && <Footer settings={settings} />}

      {numbers.length > 0 && (
        <a
          href={waHref(settings, 'general')}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Chat with Enhakkore on WhatsApp (${numbers[0]!.display})`}
          className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[#1f9d55] text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45)] transition hover:scale-105 md:inline-flex"
        >
          <SocialIcon platform="whatsapp" size={28} />
        </a>
      )}
      <MobileTabBarSpacer />
      <MobileTabBar />
    </div>
  );
}
