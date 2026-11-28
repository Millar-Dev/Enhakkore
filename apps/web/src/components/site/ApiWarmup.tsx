'use client';

import { useEffect } from 'react';
import { API_URL } from '@/lib/api';

/**
 * Wakes the API in the background as soon as someone opens the site, once per
 * browser session. On a hosting plan that sleeps when idle, the first visitor
 * then waits less for the next thing they tap.
 */
export function ApiWarmup() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('enh-warm')) return;
      sessionStorage.setItem('enh-warm', '1');
    } catch {
      /* private mode: just ping */
    }
    void fetch(`${API_URL}/health`, { cache: 'no-store', keepalive: true }).catch(() => undefined);
  }, []);
  return null;
}
