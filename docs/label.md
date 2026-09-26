# Image Optimization Guide

## Quick Start

All images use Next.js Image component with automatic optimization. Two patterns:

### 1. Static Images (OptimizedImage)
```tsx
import OptimizedImage from '@/components/common/OptimizedImage';

<OptimizedImage
  src="/images/avatar.svg"
  alt="User avatar"
  width={100}
  height={100}
/>
```

### 2. Responsive Images (fill layout)
```tsx
import Image from 'next/image';

<div className="relative w-full h-48">
  <Image
    src="/images/feature.svg"
    alt="Feature"
    fill
    sizes="(max-width: 768px) 100vw, 50vw"
  />
</div>
```

## Implementation Details

### OptimizedImage Component
- Automatic shimmer loading effect
- Configurable quality (default: 90)
- Type-safe props
- Located: `components/common/OptimizedImage.tsx`

### Blur Placeholders
Dynamic SVG shimmer generated per image:
```tsx
const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" ...>
  <linearGradient id="g">
    <stop stop-color="#1a1a2e" offset="20%" />
    <stop stop-color="#2a2a3e" offset="50%" />
    <stop stop-color="#1a1a2e" offset="70%" />
  </linearGradient>
  ...
</svg>`;
```

### Sizes Attribute
Tells browser which image size to load:
- `100vw` - Full viewport width (mobile)
- `50vw` - Half viewport (tablet)
- `33vw` - Third viewport (desktop)

Example: `sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"`

## Current Usage

- Hero: OptimizedImage (static dimensions)
- Features: Image with fill (responsive cards)
- Testimonials: OptimizedImage (avatars)

## Follow-ups

- [ ] Fix `@ts-ignore` in `hooks/useForm.ts` - replaced with proper typing using `z.ZodType<TFieldValues>`
- [ ] Consider lazy loading for below-fold images
- [ ] Add image format optimization (WebP/AVIF) if needed
