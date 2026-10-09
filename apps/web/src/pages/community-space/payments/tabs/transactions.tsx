import type { ColumnDef } from '@tanstack/react-table';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, Button, DataTable, EmptyAlert, Pagination } from '@kodinga-mono-repo/ui';
import type { AdminPayment, PaymentStatus } from '@/data/admin-community-details.data';
import { COMMISSION_RATE } from '@/data/community-billing.data';
import { paymentStatusStyle, xof } from '@/pages/shared/community-labels';
import { FilterChip } from '@/pages/shared/filter-chip';
import { dateFormat } from '@/pages/shared/row-actions';
import { downloadCsv } from '@/utils/csv';
import { useCommunitySpace } from '../../community-space-context';
import { useSpaceBilling } from '../form/UseSpaceBilling';

type Filter = 'all' | 'PAID' | 'waiting' | 'FAILED' | 'CANCELLED';

const filters: { value: Filter; label: string; match: (s: PaymentStatus) => boolean }[] = [
  { value: 'all', label: 'Tous', match: () => true },
  { value: 'PAID', label: 'Payés', match: (s) => s === 'PAID' },
  { value: 'waiting', label: 'En attente', match: (s) => s === 'PENDING' || s === 'PROCESSING' },
  { value: 'FAILED', label: 'Échecs', match: (s) => s === 'FAILED' },
  { value: 'CANCELLED', label: 'Annulés', match: (s) => s === 'CANCELLED' },
];

/** What the owner receives: amount minus the Kodinga commission, on paid transactions only */
const netOf = (p: AdminPayment) => (p.status === 'PAID' ? Math.round(p.amount * (1 - COMMISSION_RATE)) : 0);

function TransactionsTab() {
  const { community } = useCommunitySpace();
  const { payments } = useSpaceBilling();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const match = (filters.find((f) => f.value === filter) ?? filters[0]).match;
  const filtered = useMemo(() => payments.filter((p) => match(p.status)), [payments, match]);
  const visible = filtered.slice((page - 1) * size, page * size);

  const exportCsv = () =>
    downloadCsv(
      `paiements-${community.slug}.csv`,
      ['Date', 'Membre', 'Formule', 'Montant (FCFA)', 'Net (FCFA)', 'Moyen', 'Statut'],
      filtered.map((p) => [
        p.created_at.slice(0, 10),
        p.member,
        p.plan,
        p.amount,
        netOf(p),
        p.method,
        paymentStatusStyle[p.status].label,
      ])
    );

  const columns: ColumnDef<AdminPayment>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{dateFormat.format(new Date(row.original.created_at))}</span>,
    },
    { id: 'member', header: 'Membre', cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.member}</span> },
    { id: 'plan', header: 'Formule', cell: ({ row }) => <span className="text-slate-700">{row.original.plan}</span> },
    {
      id: 'amount',
      header: () => <span className="block text-right">Montant</span>,
      cell: ({ row }) => <span className="block text-right whitespace-nowrap text-slate-900 tabular-nums">{xof(row.original.amount)}</span>,
    },
    {
      id: 'net',
      header: () => <span className="block text-right">Net</span>,
      cell: ({ row }) => {
        const net = netOf(row.original);
        return <span className="block text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">{net ? xof(net) : '—'}</span>;
      },
    },
    { id: 'method', header: 'Moyen', cell: ({ row }) => <span className="text-slate-700">{row.original.method}</span> },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const s = paymentStatusStyle[row.original.status];
        return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
      },
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
          {filters.map((f) => (
            <FilterChip
              key={f.value}
              active={filter === f.value}
              onClick={() => {
                setFilter(f.value);
                setPage(1);
              }}
            >
              {f.label} <span className="tabular-nums opacity-70">{payments.filter((p) => f.match(p.status)).length}</span>
            </FilterChip>
          ))}
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download />
          Exporter (CSV)
        </Button>
      </div>
      {filtered.length === 0 ? (
        <EmptyAlert text="Aucun paiement avec ce statut." />
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
      <p className="mt-2 text-xs text-slate-500">
        Net = montant payé moins la commission Kodinga de {Math.round(COMMISSION_RATE * 100)} %.
      </p>
    </div>
  );
}

export default TransactionsTab;
