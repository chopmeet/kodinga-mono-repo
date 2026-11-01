import { cn, Loader } from '@kodinga-mono-repo/ui';
import type { PointsTransaction } from '@/utils/api/gamification/gamification.type';
import { pointsFormat } from '../leaderboard-labels';

const when = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The last 100 gains and adjustments of the community (managers), most recent first */
function PointsJournal({ items, isLoading }: { items: PointsTransaction[]; isLoading: boolean }) {
  if (isLoading) return <Loader inline size="sm" message="Chargement du journal…" />;
  if (items.length === 0) return <p className="text-sm text-slate-500">Aucun point attribué pour l’instant.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">Journal des points</caption>
        <thead className="text-xs text-slate-500 uppercase">
          <tr>
            <th className="py-2 pr-3 font-semibold">Date</th>
            <th className="py-2 pr-3 font-semibold">Membre</th>
            <th className="py-2 pr-3 font-semibold">Action</th>
            <th className="py-2 text-right font-semibold">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((t) => (
            <tr key={t.id}>
              <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{when.format(new Date(t.created_at))}</td>
              <td className="py-2 pr-3 font-medium text-slate-900">{t.user.name}</td>
              <td className="py-2 pr-3 text-slate-700">
                {t.action_label}
                {t.source === 'manual_adjustment' && (
                  <span className="block text-xs text-slate-500">
                    {t.description}
                    {t.awarded_by ? ` · par ${t.awarded_by.name}` : ''}
                  </span>
                )}
              </td>
              <td className={cn('py-2 text-right font-semibold tabular-nums', t.points < 0 ? 'text-red-700' : 'text-emerald-700')}>
                {t.points > 0 ? '+' : ''}
                {pointsFormat.format(t.points)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PointsJournal;
