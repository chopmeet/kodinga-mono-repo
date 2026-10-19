import type { ReactNode } from 'react';

/** A part of the billing the api does not serve yet: said plainly, without made-up figures */
function SoonPanel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-900" aria-hidden>
        {icon}
      </span>
      <p className="mt-4 flex items-center gap-2 font-semibold text-slate-900">
        {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Bientôt</span>
      </p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{children}</p>
    </div>
  );
}

export default SoonPanel;
