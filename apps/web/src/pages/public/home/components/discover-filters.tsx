import { ChevronDown, type LucideIcon, SlidersHorizontal } from 'lucide-react';

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kodinga/ui';

export type DiscoverChip = { id: string; label: string; icon?: LucideIcon };
export type AccessFilter = 'all' | 'free' | 'paid';
export type PrivacyFilter = 'all' | 'public' | 'private';

type Props = {
  /** Quick filters then categories, all exclusive: one active at a time */
  chips: DiscoverChip[];
  active: string;
  onChange: (id: string) => void;
  /** Pills shown before "Plus…" (the rest goes into its menu) */
  maxVisible?: number;
  access: AccessFilter;
  onAccessChange: (value: AccessFilter) => void;
  privacy: PrivacyFilter;
  onPrivacyChange: (value: PrivacyFilter) => void;
};

const pillClassName = (active: boolean) =>
  cn(
    'flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-medium whitespace-nowrap transition-colors',
    active ? 'border-blue-900 bg-blue-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
  );

/** One-line strip above the directory (no wrapping): pills, "Plus…" overflow menu, "Filtre" menu */
export function DiscoverFilters({ chips, active, onChange, maxVisible = 6, access, onAccessChange, privacy, onPrivacyChange }: Props) {
  const visible = chips.slice(0, maxVisible);
  const hidden = chips.slice(maxVisible);
  const activeHidden = hidden.find((c) => c.id === active);
  const extraFilters = Number(access !== 'all') + Number(privacy !== 'all');

  return (
    <section id="grille-communautes" className="sticky top-[72px] z-40 scroll-mt-[72px] bg-slate-50/95 backdrop-blur">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 border-b border-slate-200 py-4">
          {/* Never wraps: scrolls sideways on narrow screens */}
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" role="group" aria-label="Filtrer les communautés">
            {visible.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" aria-pressed={id === active} onClick={() => onChange(id)} className={pillClassName(id === active)}>
                {Icon && <Icon className="size-4.5" aria-hidden />}
                {label}
              </button>
            ))}
            {hidden.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className={pillClassName(!!activeHidden)}>
                  {activeHidden ? activeHidden.label : 'Plus…'}
                  <ChevronDown className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
                  {hidden.map((c) => (
                    <DropdownMenuItem key={c.id} onSelect={() => onChange(c.id)} className={cn(c.id === active && 'font-semibold text-blue-900')}>
                      {c.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className={cn(pillClassName(extraFilters > 0), 'font-semibold')} aria-label="Filtre">
              Filtre
              {extraFilters > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-900">{extraFilters}</span>
              )}
              <SlidersHorizontal className="size-4.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Accès</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={access} onValueChange={(v) => onAccessChange(v as AccessFilter)}>
                <DropdownMenuRadioItem value="all">Toutes</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="free">Gratuites</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="paid">Payantes</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Visibilité</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={privacy} onValueChange={(v) => onPrivacyChange(v as PrivacyFilter)}>
                <DropdownMenuRadioItem value="all">Toutes</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="public">Publiques</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="private">Privées (sur demande)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              {/* The api has one order (featured, then members) */}
              <DropdownMenuLabel>Trier par</DropdownMenuLabel>
              <DropdownMenuRadioGroup value="recommended">
                <DropdownMenuRadioItem value="recommended">Recommandées</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  );
}
