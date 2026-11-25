import Image from 'next/image';

/**
 * The original Enhakkore logo, exactly as supplied — never redrawn or
 * recoloured. Sized by height, so it is never stretched; width follows the
 * artwork's own proportions (640 × 500 for the full logo, 300 × 155 for the
 * emblem). The navy artwork is always placed on a light ground.
 */
export function OriginalLogo({
  src = '/partners/enhakkore-wordmark.webp',
  height,
  alt = 'Enhakkore Travel & Impact',
  priority = false,
  className,
}: {
  src?: string;
  height: number;
  alt?: string;
  priority?: boolean;
  className?: string;
}) {
  const isMark = src.includes('mark');
  const ratio = isMark ? 300 / 155 : 640 / 500;
  return (
    <Image
      src={src}
      alt={alt}
      width={Math.round(height * ratio)}
      height={height}
      priority={priority}
      className={className}
      style={{ height, width: 'auto' }}
    />
  );
}

/** The original WSC logo, as supplied (512 × 289). */
export function WscLogo({ src = '/partners/wsc.webp', height, className }: { src?: string; height: number; className?: string }) {
  return (
    <Image
      src={src}
      alt="WSC — We Save Children"
      width={Math.round((height * 512) / 289)}
      height={height}
      className={className}
      style={{ height, width: 'auto' }}
    />
  );
}
