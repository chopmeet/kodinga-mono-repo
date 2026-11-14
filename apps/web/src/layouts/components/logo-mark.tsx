import { useId } from 'react';

import { cn } from '@kodinga/ui';


const K = (
  <>
    <rect x="17.4" y="15.3" width="9.1" height="31.3" rx="2" />
    <path d="M26.5 27.1 L38.6 15.3 L44.4 15.3 Q46.9 15.6 45.6 18.6 L26.5 38.6 Z" />
    <path d="M27.8 36.7 L33.8 30.8 L46.8 44.7 Q47.9 48.3 44.6 48.4 L38.3 48.4 Z" />
  </>
);

export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#10348F" />
          <stop offset="1" stopColor="#0C2D84" />
        </linearGradient>
        <linearGradient id={`${id}-orbit`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#E0E6FF" />
          <stop offset="1" stopColor="#6F91F5" />
        </linearGradient>
        {/* The orbit fades out on the left, behind the K */}
        <radialGradient id={`${id}-fade-g`} cx="16.8" cy="33" r="9" gradientUnits="userSpaceOnUse">
          <stop offset="0.15" stopColor="#000000" />
          <stop offset="1" stopColor="#FFFFFF" />
        </radialGradient>
        <mask id={`${id}-fade`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill={`url(#${id}-fade-g)`} />
        </mask>
      </defs>
      <rect width="64" height="64" rx="15" fill="#041E69" />
      <rect width="64" height="62" rx="15" fill={`url(#${id}-bg)`} />
      <g fill="#FFFFFF">{K}</g>
      <g mask={`url(#${id}-fade)`}>
        <ellipse
          cx="31"
          cy="34.5"
          rx="28"
          ry="10"
          transform="rotate(-34 31 34.5)"
          fill="none"
          stroke={`url(#${id}-orbit)`}
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeDasharray="81 45.2"
          strokeDashoffset="-2.6"
        />
      </g>
      {/* The K again, see-through: the orbit melts into it where they cross */}
      <g fill="#FFFFFF" opacity="0.7">{K}</g>
      <circle cx="52.2" cy="15.3" r="3.4" fill="#FFFFFF" />
    </svg>
  );
}
