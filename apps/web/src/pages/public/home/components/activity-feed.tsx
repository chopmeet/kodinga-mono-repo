import { activities } from '@/data/home.data';

export function ActivityFeed() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span>Activité en temps réel</span>
        </span>
        <span className="font-mono text-[10px] text-slate-400">AFRICA_NET</span>
      </div>

      <ul className="mt-3 space-y-3 font-mono text-[11px]">
        {activities.map((a) => (
          <li key={a.who} className="flex items-start gap-2 text-slate-600">
            <span className={`font-bold ${a.markerClassName}`} aria-hidden>
              &gt;
            </span>
            <p>
              <strong className="text-slate-900">{a.who}</strong> {a.action}
              {a.target && <span className="text-slate-800"> {a.target}</span>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
