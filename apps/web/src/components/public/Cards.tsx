import { SmartImage as Image } from './SmartImage';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/components/ui';

/**
 * The card every listing uses — activity, place, event, experience, trip.
 * Photography first, an editorial kicker, a serif title, and only the facts
 * that were actually entered.
 */
export function ListingCard({
  href,
  image,
  kicker,
  title,
  meta = [],
  price,
  badges = [],
  tone = 'default',
  className,
}: {
  href: string;
  image?: string | null;
  kicker?: string | null;
  title: string;
  meta?: (string | null | undefined | false)[];
  price?: string | null;
  badges?: { label: string; tone?: 'gold' | 'navy' | 'cream' | 'muted' | 'green' | 'demo' }[];
  tone?: 'default' | 'past';
  className?: string;
}) {
  return (
    <Link href={href} className={cx('group card-lift block overflow-hidden rounded-[1.1rem] border border-line bg-white', className)}>
      <div className="relative aspect-[4/3] overflow-hidden bg-[color:var(--color-cream-deep)] md:aspect-[16/10]">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={cx('object-cover transition-transform duration-700 group-hover:scale-[1.04]', tone === 'past' && 'grayscale-[35%]')}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#f1e3bf,transparent_60%),linear-gradient(135deg,#0e4269,#082b45)]">
            <span className="font-display text-3xl text-white/85">{title.slice(0, 1)}</span>
          </div>
        )}
        {badges.length > 0 && (
          <div className="absolute left-2 top-2 flex flex-wrap gap-1 md:left-3 md:top-3 md:gap-1.5">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={cx(
                  'rounded-full px-2 py-0.5 text-[0.5625rem] font-bold uppercase tracking-[0.06em] shadow-sm md:px-2.5 md:py-1 md:text-[0.6875rem]',
                  badge.tone === 'demo' && 'bg-[#7c3aed] text-white',
                  badge.tone === 'gold' && 'bg-clay-400 text-acacia-700',
                  badge.tone === 'navy' && 'bg-acacia-600 text-white',
                  badge.tone === 'green' && 'bg-safari-500 text-white',
                  badge.tone === 'muted' && 'bg-white/90 text-ink-muted',
                  (!badge.tone || badge.tone === 'cream') && 'bg-white/95 text-acacia-700',
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="p-2.5 md:p-4">
        {kicker && <p className="truncate text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-clay-600 md:text-[0.6875rem]">{kicker}</p>}
        <h3 className="mt-1 line-clamp-2 font-display text-[1.02rem] leading-tight text-acacia-700 md:text-[1.3rem]">{title}</h3>
        <div className="mt-1 space-y-0.5 text-[0.72rem] text-ink-muted md:mt-1.5 md:text-[0.8125rem]">
          {meta.filter(Boolean).map((line) => (
            <p key={String(line)} className="truncate">
              {line}
            </p>
          ))}
        </div>
        {price && <p className="mt-1.5 text-[0.8125rem] font-bold text-acacia-600 md:mt-2 md:text-[0.9375rem]">{price}</p>}
      </div>
    </Link>
  );
}

export function CardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-3', className)}>{children}</div>;
}

/** Page opening: kicker, serif title, intro, optional photograph. */
export function PageHero({
  kicker,
  title,
  intro,
  image,
  children,
}: {
  kicker: string;
  title: string;
  intro?: string | null;
  image?: string | null;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-[color:var(--color-cream)]">
      {image && (
        <div className="absolute inset-y-0 right-0 hidden w-[42%] lg:block">
          <Image src={image} alt="" fill priority sizes="42vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--color-cream)] via-[color:var(--color-cream)]/20 to-transparent" />
        </div>
      )}
      <div className="shell relative py-12 md:py-20">
        <div className={image ? 'max-w-2xl' : 'max-w-3xl'}>
          <p className="kicker">{kicker}</p>
          <h1 className="display-lg mt-4 text-acacia-700">{title}</h1>
          {intro && <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-ink-soft">{intro}</p>}
          {children && <div className="mt-7">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/** An honest empty state: says what is true, and gives somewhere useful to go. */
export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-[1.1rem] border border-dashed border-line-strong bg-[color:var(--color-cream)] px-6 py-12 text-center">
      <p className="font-display text-2xl text-acacia-700">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">{body}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function SectionTitle({ kicker, title, subtitle, action }: { kicker?: string; title: string; subtitle?: string | null; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-3 md:mb-9 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {kicker && <p className="kicker">{kicker}</p>}
        <h2 className="display-md mt-3 text-acacia-700">{title}</h2>
        {subtitle && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Gallery({ images, alt = '' }: { images: { src: string; alt?: string; credit?: string | null; licence?: string | null; source?: string | null }[]; alt?: string }) {
  if (images.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
      {images.map((image, index) => (
        <figure key={`${image.src}-${index}`} className={cx('relative overflow-hidden rounded-xl bg-sand', index === 0 && images.length > 2 ? 'col-span-2 row-span-2 aspect-[4/3] md:aspect-auto' : 'aspect-[4/3]')}>
          <Image src={image.src} alt={image.alt ?? alt} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
          {image.credit && (
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-1.5 pt-6 text-[0.625rem] text-white/85">
              {image.source ? (
                <a href={image.source} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">
                  © {image.credit}
                  {image.licence ? ` · ${image.licence}` : ''}
                </a>
              ) : (
                <>© {image.credit}</>
              )}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

/** A fact row on a detail page — label over value, only when there is a value. */
export function Facts({ items }: { items: { label: string; value: ReactNode | null | undefined }[] }) {
  const shown = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
  if (shown.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-[1.1rem] border border-line bg-white p-5 sm:grid-cols-3">
      {shown.map((item) => (
        <div key={item.label}>
          <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-ink-muted">{item.label}</dt>
          <dd className="mt-1 text-[0.9375rem] font-semibold text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function VideoBlock({ url }: { url?: string | null }) {
  if (!url) return null;
  const youtube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (youtube) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtube[1]}`}
          title="Video"
          loading="lazy"
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/video/upload/')) {
    return <video src={url} controls preload="metadata" playsInline className="w-full rounded-xl bg-black" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="font-semibold text-acacia-600 underline underline-offset-4">
      Watch the video
    </a>
  );
}

/** Text with paragraphs kept, no HTML interpreted. */
export function Prose({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <div className={cx('space-y-4 text-[1rem] leading-[1.75] text-ink-soft', className)}>
      {text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
    </div>
  );
}
