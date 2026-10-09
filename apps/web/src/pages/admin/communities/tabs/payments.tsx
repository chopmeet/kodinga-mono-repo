import type { ColumnDef } from '@tanstack/react-table';

import { Badge, DataTable, EmptyAlert } from '@kodinga-mono-repo/ui';
import { type AdminPayment, getCommunityPayments } from '@/data/admin-community-details.data';
import { paymentStatusStyle as statusStyle, xof } from '@/pages/shared/community-labels';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';
import { dateFormat } from '@/pages/shared/row-actions';

function CommunityPaymentsTab() {
  const community = useDetailsCommunity();
  const payments = getCommunityPayments(community);

  if (community.pricing_type !== 'paid') {
    return <EmptyAlert text="Communauté gratuite : aucun paiement à afficher." />;
  }

  const paid = payments.filter((p) => p.status === 'PAID');
  const summary = [
    { label: 'Encaissé (45 j)', value: xof(paid.reduce((s, p) => s + p.amount, 0)) },
    { label: 'Paiements réussis', value: `${paid.length} / ${payments.length}` },
    { label: 'En attente ou en échec', value: payments.filter((p) => p.status === 'PENDING' || p.status === 'FAILED').length },
  ];

  const columns: ColumnDef<AdminPayment>[] = [
    { id: 'member', header: 'Membre', cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.member}</span> },
    { id: 'plan', header: 'Offre', cell: ({ row }) => <span className="text-slate-700">{row.original.plan}</span> },
    {
      id: 'amount',
      header: () => <span className="block text-right">Montant</span>,
      cell: ({ row }) => <span className="block text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">{xof(row.original.amount)}</span>,
    },
    { id: 'method', header: 'Moyen', cell: ({ row }) => <span className="text-slate-700">{row.original.method}</span> },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const s = statusStyle[row.original.status];
        return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
      },
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{dateFormat.format(new Date(row.original.created_at))}</span>,
    },
  ];

  return (
    <div>
      <dl className="mb-4 grid gap-3 sm:grid-cols-3">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">{s.label}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <DataTable columns={columns} data={payments} isLoading={false} />
      <p className="mt-2 text-xs text-slate-500">Paiements Mobile Money et carte via PayDunya.</p>
    </div>
  );
}

export default CommunityPaymentsTab;
