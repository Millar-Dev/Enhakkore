'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Icon, cx } from '@/components/ui';

/**
 * Trip hero gallery.
 *
 * A large primary frame with a strip of supporting shots. Tapping any image
 * opens a full-screen viewer with keyboard navigation, because on a phone the
 * thumbnails are too small to judge a place by.
 */
export function TripGallery({ images, title }: { images: string[]; title: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const shots = images.filter(Boolean).slice(0, 5);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null);
      if (event.key === 'ArrowRight') setLightbox((index) => ((index ?? 0) + 1) % shots.length);
      if (event.key === 'ArrowLeft') setLightbox((index) => ((index ?? 0) - 1 + shots.length) % shots.length);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightbox, shots.length]);

  if (shots.length === 0) return null;

  return (
    <>
      <div className="grid gap-2 md:grid-cols-[2fr_1fr] md:gap-3">
        <button
          type="button"
          onClick={() => setLightbox(0)}
          className="media group relative aspect-[4/3] w-full overflow-hidden rounded-[--radius-card] md:aspect-[3/2]"
          aria-label={`View photographs of ${title}`}
        >
          <Image
            src={shots[0]}
            alt={title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover"
          />
        </button>

        {shots.length > 1 && (
          <div className="grid grid-cols-4 gap-2 md:grid-cols-2 md:gap-3">
            {shots.slice(1, 5).map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setLightbox(index + 1)}
                className="media group relative aspect-square overflow-hidden rounded-[0.625rem] md:rounded-[--radius-card]"
                aria-label={`Photograph ${index + 2}`}
              >
                <Image src={image} alt="" fill sizes="(max-width: 768px) 25vw, 20vw" className="object-cover" />
                {index === 3 && shots.length > 5 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-[0.875rem] font-bold text-white">
                    +{shots.length - 5}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[70] flex animate-fade flex-col bg-[#080a0b]/97"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photographs`}
        >
          <div className="flex h-16 shrink-0 items-center justify-between px-5">
            <span className="text-[0.875rem] font-medium text-white/60">
              {lightbox + 1} / {shots.length}
            </span>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Close"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              <Icon.close size={22} />
            </button>
          </div>

          <div className="relative flex-1">
            <Image src={shots[lightbox]} alt="" fill sizes="100vw" className="object-contain" />
          </div>

          <div className="flex h-20 shrink-0 items-center justify-center gap-2">
            {shots.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setLightbox(index)}
                aria-label={`Photograph ${index + 1}`}
                className={cx(
                  'h-1.5 rounded-full transition-all',
                  index === lightbox ? 'w-8 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/60',
                )}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
