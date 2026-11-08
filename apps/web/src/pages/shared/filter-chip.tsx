import type { ReactNode } from 'react';

import { cn } from '@kodinga/ui';

/** Toggle chip used in the list filters (put several in a role="group" with an aria-label) */
type Props = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Shown but not selectable yet (e.g. a filter the api does not support) */
  disabled?: boolean;
  title?: string;
};

export function FilterChip({ active, onClick, children, disabled, title }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
        disabled && 'cursor-not-allowed opacity-50 hover:border-slate-200'
      )}
    >
      {children}
    </button>
  );
}
