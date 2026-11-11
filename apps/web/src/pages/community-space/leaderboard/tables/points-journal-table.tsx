import type { ColumnDef } from '@tanstack/react-table';

import { cn, DataTable, Loader } from '@kodinga/ui';
import type { PointsTransaction } from '@/utils/api/gamification/gamification.type';
import { formatDateTime } from '@/utils/format';
import { pointsFormat } from '../leaderboard-labels';

const columns: ColumnDef<PointsTransaction>[] = [
  { id: 'member', header: 'Membre', cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.user.name}</span> },
  {
    id: 'points',
    header: () => <span className="block text-right">Points</span>,
    cell: ({ row }) => {
      const { points } = row.original;
      return (
        <span className={cn('block text-right font-semibold tabular-nums', points < 0 ? 'text-red-700' : 'text-emerald-700')}>
          {points > 0 ? '+' : ''}
          {pointsFormat.format(points)}
        </span>
      );
    },
  },
  {
    id: 'action',
    header: 'Action',
    cell: ({ row }) => {
      const t = row.original;
      return (
        <span className="text-slate-700">
          {t.action_label}
          {t.source === 'manual_adjustment' && (
            <span className="block max-w-64 text-xs whitespace-normal text-slate-500">
              {t.description}
              {t.awarded_by ? ` · par ${t.awarded_by.name}` : ''}
            </span>
          )}
        </span>
      );
    },
  },
  { id: 'date', header: 'Date', cell: ({ row }) => <span className="text-slate-500">{formatDateTime(row.original.created_at)}</span> },
];

/** The last 100 gains and adjustments of the community (managers), most recent first */
function PointsJournalTable({ items, isLoading }: { items: PointsTransaction[]; isLoading: boolean }) {
  if (isLoading) return <Loader inline size="sm" message="Chargement du journal…" />;
  if (items.length === 0) return <p className="text-sm text-slate-500">Aucun point attribué pour l’instant.</p>;

  return <DataTable columns={columns} data={items} isLoading={false} caption="Journal des points" />;
}

export default PointsJournalTable;
