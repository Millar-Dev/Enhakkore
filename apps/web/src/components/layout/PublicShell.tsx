import type { ReactNode } from 'react';
import { MobileTabBar, MobileTabBarSpacer } from './MobileTabBar';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/**
 * Wrapper for every public-facing page.
 *
 * `transparentHeader` is for pages that open with a full-bleed image; those
 * pages own their own top spacing. Everything else gets the header's height
 * added so content never starts underneath it.
 */
export function PublicShell({
  children,
  transparentHeader = false,
  footer = true,
}: {
  children: ReactNode;
  transparentHeader?: boolean;
  footer?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader transparent={transparentHeader} />
      <main id="main" className={transparentHeader ? 'flex-1' : 'flex-1 pt-16 md:pt-[4.5rem]'}>
        {children}
      </main>
      {footer && <SiteFooter />}
      <MobileTabBarSpacer />
      <MobileTabBar />
    </div>
  );
}
