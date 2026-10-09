import type { ColumnDef } from '@tanstack/react-table';
import { BellRing } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, Button, DataTable, EmptyAlert, Pagination } from '@kodinga-mono-repo/ui';
import type { SpaceSubscription, SubscriptionStatus } from '@/data/community-billing.data';
import { subscriptionStatusStyle } from '@/pages/shared/community-labels';
import { FilterChip } from '@/pages/shared/filter-chip';
import { dateFormat } from '@/pages/shared/row-actions';
import { useSpaceBilling } from '../form/UseSpaceBilling';

type Filter = 'all' | 'active' | 'trialing' | 'past_due' | 'ended';

const filters: { value: Filter; label: string; match: (s: SubscriptionStatus) => boolean }[] = [
  { value: 'all', label: 'Tous', match: () => true },
  { value: 'active', label: 'Actifs', match: (s) => s === 'active' },
  { value: 'trialing', label: 'En essai', match: (s) => s === 'trialing' },
  { value: 'past_due', label: 'Impayés', match: (s) => s === 'past_due' },
  { value: 'ended', label: 'Résiliés ou expirés', match: (s) => s === 'canceled' || s === 'expired' },
];

function SubscribersTab() {
  const { subscriptions, remind } = useSpaceBilling();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const match = (filters.find((f) => f.value === filter) ?? filters[0]).match;
  const filtered = useMemo(() => subscriptions.filter((s) => match(s.status)), [subscriptions, match]);
  const visible = filtered.slice((page - 1) * size, page * size);

  const columns: ColumnDef<SpaceSubscription>[] = [
    { id: 'member', header: 'Membre', cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.member}</span> },
    { id: 'plan', header: 'Formule', cell: ({ row }) => <span className="text-slate-700">{row.original.plan}</span> },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const s = subscriptionStatusStyle[row.original.status];
        return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
      },
    },
    {
      id: 'period',
      header: 'Échéance',
      cell: ({ row }) => {
        const s = row.original;
        const end = dateFormat.format(new Date(s.current_period_end));
        const ended = s.status === 'canceled' || s.status === 'expired';
        return (
          <div className="whitespace-nowrap">
            <p className="text-slate-700">{end}</p>
            <p className="text-xs text-slate-500">
              {ended ? 'Accès terminé' : s.cancel_at_period_end ? "S'arrête à l'échéance" : 'Renouvellement automatique'}
            </p>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        row.original.status === 'past_due' ? (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => remind(row.original)} aria-label={`Relancer ${row.original.member}`}>
              <BellRing />
              Relancer
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {filters.map((f) => (
          <FilterChip
            key={f.value}
            active={filter === f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
          >
            {f.label} <span className="tabular-nums opacity-70">{subscriptions.filter((s) => f.match(s.status)).length}</span>
          </FilterChip>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyAlert text="Aucun abonnement avec ce statut." />
      ) : (
        <>
          <DataTable columns={columns} data={visible} isLoading={false} />
          <Pagination
            totalItems={filtered.length}
            currentPage={page}
            perPage={size}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setSize(n);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}

export default SubscribersTab;
