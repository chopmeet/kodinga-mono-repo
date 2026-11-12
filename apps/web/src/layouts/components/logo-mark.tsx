import { useId } from 'react';

import { cn } from '@kodinga/ui';

/**
 * The Kodinga mark: a white K on a vivid blue rounded square, a translucent orbit around it and a
 * white dot. SVG, sharp at any size, the same drawing as public/favicon.svg. Gradient ids are made
 * unique: several marks can be on the page.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A47F8" />
          <stop offset="1" stopColor="#0339EF" />
        </linearGradient>
        <linearGradient id={`${id}-orbit`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#0128D0" />
      <rect width="64" height="62" rx="15" fill={`url(#${id}-bg)`} />
      <g fill="#FFFFFF">
        <rect x="17.4" y="15.3" width="9.1" height="31.3" rx="2" />
        <path d="M26.5 27.1 L38.6 15.3 L44.4 15.3 Q46.9 15.6 45.6 18.6 L26.5 38.6 Z" />
        <path d="M27.8 36.7 L33.8 30.8 L46.8 44.7 Q47.9 48.3 44.6 48.4 L38.3 48.4 Z" />
      </g>
      <ellipse
        cx="30.9"
        cy="33.6"
        rx="27.2"
        ry="8.4"
        transform="rotate(-31 30.9 33.6)"
        fill="none"
        stroke={`url(#${id}-orbit)`}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeDasharray="68 54"
        strokeDashoffset="-3"
      />
      <circle cx="52.2" cy="15.3" r="3.4" fill="#FFFFFF" />
    </svg>
  );
}
