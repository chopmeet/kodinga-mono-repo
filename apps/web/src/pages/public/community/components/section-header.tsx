import type { ReactNode } from 'react';

/** Head of a tab: small caps line, title, sentence, and something on the right (count, icon) */
export function SectionHeader({ eyebrow, title, children, aside }: { eyebrow: string; title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-600 uppercase">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
        {children && <p className="mt-4 text-slate-600">{children}</p>}
      </div>
      {aside && <div className="shrink-0 pt-6">{aside}</div>}
    </div>
  );
}

/** Filter pill of the tabs (dark blue when active) */
export function Pill({ active, onClick, children, disabled, title }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        active
          ? 'flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-medium text-white'
          : 'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60'
      }
    >
      {children}
    </button>
  );
}
