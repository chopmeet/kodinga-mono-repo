import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@kodinga/ui';

export function FormAlert({ variant = 'error', children }: { variant?: 'error' | 'success'; children: ReactNode }) {
  const Icon = variant === 'error' ? CircleAlert : CircleCheck;
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm',
        variant === 'error'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
