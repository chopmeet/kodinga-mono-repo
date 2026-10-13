import { cn } from '@kodinga-mono-repo/ui';

export type DiscoverFilter = { id: string; label: string; emoji?: string };

type Props = {
  filters: DiscoverFilter[];
  active: string;
  onChange: (id: string) => void;
};

/** Sticky filter strip above the directory: quick filters, then the api categories */
export function DiscoverFilters({ filters, active, onChange }: Props) {
  return (
    <section id="grille-communautes" className="sticky top-16 z-40 scroll-mt-16 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-col px-4 py-3 sm:px-6 lg:px-8">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto" role="group" aria-label="Filtrer les communautés">
          {filters.map((f) => {
            const isActive = f.id === active;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onChange(f.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors sm:text-sm',
                  isActive ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                {f.emoji && <span aria-hidden>{f.emoji}</span>}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
