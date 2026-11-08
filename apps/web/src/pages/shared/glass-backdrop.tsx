import { useId } from 'react';

import { cn } from '@kodinga/ui';

/**
 * Abstract blue glass ribbons (the hero picture of the design, redrawn in SVG so no image is needed).
 * Decorative: fills its positioned parent; `fade` blends it into the page on the left.
 */
export function GlassBackdrop({ className, fade = true }: { className?: string; fade?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-0 bg-linear-to-br from-slate-50 via-blue-50 to-blue-200" />
      <svg className="absolute inset-0 size-full" viewBox="0 0 1200 600" preserveAspectRatio="xMaxYMid slice">
        <defs>
          <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#93c5fd" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`${id}-b`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e40af" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#60a5fa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-c`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.2" />
          </linearGradient>
          <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <path d="M720 -40 C 980 120, 1040 330, 860 640 L 1240 640 L 1240 -40 Z" fill={`url(#${id}-a)`} />
        <path d="M860 -40 C 1120 180, 1180 380, 1020 640 L 1240 640 L 1240 -40 Z" fill={`url(#${id}-b)`} />
        <path d="M640 -40 C 900 140, 960 360, 760 640" fill="none" stroke={`url(#${id}-c)`} strokeWidth="28" filter={`url(#${id}-blur)`} />
        <path d="M960 -40 C 1180 160, 1230 420, 1080 640" fill="none" stroke={`url(#${id}-c)`} strokeWidth="14" />
        <path d="M800 -40 C 1060 150, 1110 380, 930 640" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" />
      </svg>
      {fade && <div className="absolute inset-0 bg-linear-to-r from-white via-white/70 to-transparent" />}
    </div>
  );
}
