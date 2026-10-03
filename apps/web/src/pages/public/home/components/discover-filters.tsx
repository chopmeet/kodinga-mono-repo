import { cn } from '@kodinga-mono-repo/ui';

import {
  categories,
  type CategoryId,
  type SortId,
  sortOptions,
  type StackId,
  stacks,
} from '@/data/home.data';

type Props = {
  category: CategoryId;
  onCategoryChange: (id: CategoryId) => void;
  stack: StackId | null;
  onStackChange: (id: StackId | null) => void;
  sort: SortId;
  onSortChange: (id: SortId) => void;
};

export function DiscoverFilters({
  category,
  onCategoryChange,
  stack,
  onStackChange,
  sort,
  onSortChange,
}: Props) {
  return (
    <section
      id="grille-communautes"
      className="sticky top-16 z-40 scroll-mt-16 border-b border-slate-200 bg-white"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="no-scrollbar flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-1.5">
            {categories.map((c) => {
              const active = c.id === category;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCategoryChange(c.id)}
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm',
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {c.emoji && <span aria-hidden>{c.emoji}</span>}
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="community-sort" className="hidden text-xs font-medium text-slate-400 md:inline">
              Trier par :
            </label>
            <select
              id="community-sort"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortId)}
              className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-brand"
            >
              {sortOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="shrink-0 font-mono text-[11px] font-medium text-slate-400">STACKS :</span>
          {stacks.map((s) => {
            const active = s.id === stack;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => onStackChange(active ? null : s.id)}
                className={cn(
                  'rounded-full px-2.5 py-1 font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-brand text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                # {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
