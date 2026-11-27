'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * The round gold filter button and the sheet it opens: a bottom sheet on
 * phones, a centred panel on larger screens. The filter form itself is
 * rendered by the page and passed in.
 */
export function FilterSheet({ title = 'Filter results', active = 0, children, resetHref }: { title?: string; active?: number; children: ReactNode; resetHref?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={active ? `Filters, ${active} on` : 'Filters'} className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-400 text-acacia-700 shadow-lg hover:bg-clay-500">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
        {active > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#06172b] px-1 text-center text-[0.625rem] font-bold leading-5 text-white ring-1 ring-clay-400">{active}</span>}
      </button>
      {open &&
        createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="enh-fade-in relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#06172b] text-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">✕</button>
              <p className="font-bold">{title}</p>
              {resetHref ? <a href={resetHref} className="inline-flex h-11 items-center px-2 text-xs font-semibold text-clay-400">Reset</a> : <span className="w-11" />}
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
