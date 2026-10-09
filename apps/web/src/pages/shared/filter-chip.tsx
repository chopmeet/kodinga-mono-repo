import type { ReactNode } from 'react';

import { cn } from '@kodinga-mono-repo/ui';

/** Toggle chip used in the list filters (put several in a role="group" with an aria-label) */
export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      )}
    >
      {children}
    </button>
  );
}
