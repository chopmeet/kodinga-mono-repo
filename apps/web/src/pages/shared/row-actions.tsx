import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kodinga-mono-repo/ui';

export type RowAction = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  /** Shown but disabled, with a "Bientôt" mark (the api does not support it yet) */
  soon?: boolean;
};

/** "…" menu shared by the details tables */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onSelect={action.onSelect}
            disabled={action.soon}
            className={cn(action.danger && 'text-red-600 focus:text-red-700')}
          >
            {action.icon}
            {action.label}
            {action.soon && <SoonBadge className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

/** Marks a feature the api does not offer yet */
export function SoonBadge({ className }: { className?: string }) {
  return (
    <span className={cn('rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase', className)}>
      Bientôt
    </span>
  );
}
