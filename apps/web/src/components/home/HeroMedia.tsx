'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui';

/**
 * Hero background: a photograph that paints immediately, with a looping video
 * that fades in over it once the page has finished loading.
 *
 * The rules that keep this from costing load time or data:
 *
 * - The photo is the real content. It is a priority image, so it — not the
 *   video — is what the browser optimises first paint around. Page speed is
 *   identical to having no video at all.
 * - The video element does not exist until after the window `load` event and
 *   an idle moment, so it never competes with the page's own requests.
 * - Visitors who have asked for less — Data Saver, a 2G connection, or
 *   "reduce motion" — never download it. They keep the photo.
 * - Smaller screens get a smaller file (see `pickSource`).
 * - Playback pauses whenever the hero is off-screen or the tab is hidden.
 * - If anything fails, the video simply never fades in.
 */

export interface HeroVideoSource {
  src: string;
  /** Use this file when the viewport is at most this wide, in CSS pixels. */
  maxViewport: number;
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

function shouldLoadVideo(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') return false;

  return true;
}

function pickSource(sources: HeroVideoSource[]): string | null {
  if (sources.length === 0) return null;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  const sorted = [...sources].sort((a, b) => a.maxViewport - b.maxViewport);

  // On a 3G connection, always take the smallest file regardless of screen.
  if (connection?.effectiveType === '3g') return sorted[0].src;

  const match = sorted.find((source) => window.innerWidth <= source.maxViewport);
  return (match ?? sorted[sorted.length - 1]).src;
}

export function HeroMedia({
  poster,
  alt,
  videos = [],
}: {
  poster: string;
  alt: string;
  videos?: HeroVideoSource[];
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Decide, after load and an idle moment, whether to fetch a video at all.
  useEffect(() => {
    if (videos.length === 0 || !shouldLoadVideo()) return;

    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const schedule =
        (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
          .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
      schedule(() => !cancelled && setSrc(pickSource(videos)), { timeout: 2000 });
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
    };
  }, [videos]);

  // Pause off-screen and in hidden tabs; resume when back.
  useEffect(() => {
    const video = videoRef.current;
    const wrap = wrapRef.current;
    if (!video || !wrap || !src) return;

    let onScreen = true;
    const sync = () => {
      if (onScreen && document.visibilityState === 'visible') {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    observer.observe(wrap);
    document.addEventListener('visibilitychange', sync);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [src]);

  return (
    <div ref={wrapRef} className="absolute inset-0" aria-hidden={src ? undefined : true}>
      <Image src={poster} alt={alt} fill priority sizes="100vw" className="object-cover" />

      {src && (
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          tabIndex={-1}
          // Fade in only once frames are actually moving, so there is never a
          // black flash or a frozen first frame over the photo.
          onPlaying={() => setVisible(true)}
          onError={() => setSrc(null)}
          className={cx(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-out',
            visible ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
}
