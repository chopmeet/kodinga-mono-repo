import type { LucideIcon } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

import { cn } from '@kodinga/ui';

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
        'flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong',
        'has-checked:border-brand has-checked:bg-brand/5 has-checked:ring-1 has-checked:ring-brand',
        'has-focus-visible:ring-4 has-focus-visible:ring-brand/25',
        className
      )}
    >
      <input type="radio" className="sr-only" {...radio} />
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-body">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
