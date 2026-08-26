import Image from 'next/image';

/**
 * Props accepted by {@link OptimizedImage}.
 *
 * The wrapper requires the image source, accessible alternative text, and
 * intrinsic dimensions used by Next.js to reserve space before the image loads.
 */
interface OptimizedImageProps {
  /** Image URL or a path from the Next.js image configuration. */
  src: string;
  /** Accessible description of the image. */
  alt: string;
  /** Intrinsic image width in pixels. */
  width: number;
  /** Intrinsic image height in pixels. */
  height: number;
  /** Load the image eagerly when it is important to the initial viewport. */
  priority?: boolean;
  /** CSS class names applied to the underlying Next.js Image. */
  className?: string;
  /** Responsive image sizes hint passed to Next.js. */
  sizes?: string;
}

/**
 * Renders a Next.js Image with the project's shared optimization defaults.
 *
 * Use this wrapper for static images so they consistently receive quality
 * settings and an animated blur placeholder while loading. Provide `sizes`
 * when the rendered image has responsive dimensions, and set `priority` only
 * for images needed immediately by the initial viewport.
 *
 * @param props Image source, accessibility text, dimensions, and optional
 *              loading or styling settings.
 * @returns An optimized Next.js Image component.
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  sizes,
}: OptimizedImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
      sizes={sizes}
      quality={90}
      placeholder="blur"
      blurDataURL={`data:image/svg+xml;base64,${toBase64(shimmer(width, height))}`}
    />
  );
}

// Shimmer effect for loading placeholder
const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#1a1a2e" offset="20%" />
      <stop stop-color="#2a2a3e" offset="50%" />
      <stop stop-color="#1a1a2e" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#1a1a2e" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`;

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);
