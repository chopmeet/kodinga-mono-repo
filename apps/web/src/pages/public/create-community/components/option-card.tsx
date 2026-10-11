import type { LucideIcon } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

import { cn } from '@kodinga-mono-repo/ui';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  title: string;
  description: string;
  icon: LucideIcon;
};

/** Radio choice displayed as a card (the native radio stays for keyboard and screen readers) */
export function OptionCard({ title, description, icon: Icon, className, ...radio }: Props) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300',
        'has-checked:border-brand has-checked:bg-brand/5 has-checked:ring-1 has-checked:ring-brand',
        'has-focus-visible:ring-4 has-focus-visible:ring-brand/25',
        className
      )}
    >
      <input type="radio" className="sr-only" {...radio} />
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{description}</span>
      </span>
    </label>
  );
}
