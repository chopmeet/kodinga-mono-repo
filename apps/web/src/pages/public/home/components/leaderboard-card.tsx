import { Sparkles, Trophy } from 'lucide-react';

import { cn } from '@kodinga-mono-repo/ui';
import { leaderboard } from '@/data/home.data';

/** "Pulse" of the communities: illustrative ranking until the api exposes one */
export function LeaderboardCard() {
  return (
    <section aria-labelledby="pulse-title" className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="pulse-title" className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
            <Trophy className="size-5 text-amber-500" aria-hidden />
            Le pouls des communautés
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">Les guildes qui font bouger la tech.</p>
        </div>
        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
      </div>

      <ol className="mt-5 divide-y divide-slate-100 border-b border-slate-100">
        {leaderboard.map((entry) => (
          <li key={entry.rank} className="flex items-center gap-3 py-4">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                entry.rank === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
              )}
            >
              {entry.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{entry.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {entry.xp.replace(/^\+/, '')}
                {entry.bounties !== undefined && ` · ${entry.bounties} bounties`}
              </p>
            </div>
            {entry.growth && <span className="shrink-0 text-xs font-semibold text-primary">{entry.growth}</span>}
          </li>
        ))}
      </ol>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <Sparkles className="size-3.5" aria-hidden />
        Classement illustratif
      </p>
    </section>
  );
}
