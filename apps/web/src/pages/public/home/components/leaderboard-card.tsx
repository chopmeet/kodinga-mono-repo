import { cn } from '@kodinga-mono-repo/ui';

import { leaderboard } from '@/data/home.data';

const podiumClassName: Record<number, { row: string; medal: string }> = {
  1: { row: 'bg-amber-50/70 border-amber-200/80', medal: 'bg-amber-400 text-slate-950' },
  2: { row: 'bg-slate-50 border-slate-100', medal: 'bg-slate-300 text-slate-800' },
  3: { row: 'bg-slate-50 border-slate-100', medal: 'bg-orange-200 text-orange-950' },
};

export function LeaderboardCard() {
  const podium = leaderboard.filter((e) => e.rank <= 3);
  const others = leaderboard.filter((e) => e.rank > 3);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            👑
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Leaderboard Continental</h3>
            <p className="font-mono text-[11px] text-slate-500">TOP GUILDES DU MOIS</p>
          </div>
        </div>
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
          10K$ BOUNTIES
        </span>
      </div>

      <ol className="space-y-3 py-4">
        {podium.map((entry) => (
          <li
            key={entry.rank}
            className={cn(
              'flex items-center justify-between rounded-lg border p-2',
              podiumClassName[entry.rank].row
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  podiumClassName[entry.rank].medal
                )}
              >
                {entry.rank}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">{entry.name}</p>
                <p className="font-mono text-[10px] text-slate-500">
                  {entry.xp} • {entry.bounties} bounties
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-[11px] font-bold text-emerald-600">
              {entry.growth}
            </span>
          </li>
        ))}

        {others.map((entry) => (
          <li key={entry.rank} className="flex items-center justify-between px-2 py-1 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-5 text-center font-mono font-semibold text-slate-400">{entry.rank}</span>
              <span className="truncate">{entry.name}</span>
            </div>
            <span className="font-mono text-[11px] text-slate-500">{entry.xp}</span>
          </li>
        ))}
      </ol>

      <a
        href="#leaderboard"
        className="block border-t border-slate-100 pt-2 text-center text-xs font-semibold text-brand hover:text-brand-hover"
      >
        Voir le classement complet (100+) →
      </a>
    </div>
  );
}
