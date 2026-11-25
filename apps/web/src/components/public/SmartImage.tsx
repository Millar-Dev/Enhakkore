import Image, { type ImageProps } from 'next/image';

const OPTIMISED_HOSTS = ['res.cloudinary.com', 'images.unsplash.com', 'localhost', '127.0.0.1'];

/**
 * next/image, but safe for any link the owner pastes in the control centre:
 * images from our own site and image service are resized and converted; any
 * other address is shown as-is rather than breaking the page.
 */
export function SmartImage(props: ImageProps) {
  const src = typeof props.src === 'string' ? props.src : '';
  let optimise = true;
  if (/^https?:\/\//.test(src)) {
    try {
      optimise = OPTIMISED_HOSTS.includes(new URL(src).hostname);
    } catch {
      optimise = false;
    }
  }
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} unoptimized={props.unoptimized ?? !optimise} />;
}
