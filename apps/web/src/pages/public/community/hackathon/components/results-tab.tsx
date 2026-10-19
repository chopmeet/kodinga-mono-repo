import { Code2, ExternalLink, Trophy } from 'lucide-react';

import { cn } from '@kodinga-mono-repo/ui';
import type { HackathonResult } from '@/utils/api/hackathon/hackathon.type';

const medal = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950'];

/** Published ranking: projects by score, with the prizes they won */
function ResultsTab({ results }: { results: HackathonResult[] }) {
  if (results.length === 0) return <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Aucun projet classé.</p>;
  return (
    <ol className="flex flex-col gap-3" aria-label="Classement">
      {results.map((r, i) => {
        const rank = r.rank ?? i + 1;
        return (
          <li key={r.id} className={cn('flex items-start gap-4 rounded-xl border bg-white p-5', rank <= 3 ? 'border-amber-200' : 'border-slate-200')}>
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold', medal[rank - 1] ?? 'bg-slate-100 text-slate-600')}>{rank}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900">{r.title}</h3>
              <p className="text-sm text-slate-500">
                {r.team_name ? `Équipe ${r.team_name}` : r.applicant_username}
                {r.tagline && ` · ${r.tagline}`}
              </p>
              {r.won_prizes.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-2">
                  {r.won_prizes.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      <Trophy className="size-3.5" /> {p.title}
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-2 flex flex-wrap gap-4 text-sm">
                {r.demo_url && (
                  <a href={r.demo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-900 hover:underline">
                    <ExternalLink className="size-3.5" /> Démo
                  </a>
                )}
                {r.repository_url && (
                  <a href={r.repository_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-900 hover:underline">
                    <Code2 className="size-3.5" /> Code
                  </a>
                )}
              </p>
            </div>
            {r.total_score !== null && (
              <span className="shrink-0 text-right">
                <span className="block text-lg font-semibold text-slate-900 tabular-nums">{Number(r.total_score).toFixed(1)}</span>
                <span className="text-xs text-slate-500">points</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default ResultsTab;
