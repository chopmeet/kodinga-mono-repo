import type { ColumnDef } from '@tanstack/react-table';

import { cn, DataTable } from '@kodinga/ui';
import { payoutMethodLabel, payoutStatusStyle, xof } from '@/utils/Utils';
import type { CommunityPayout } from '@/utils/api/billing/billing.type';
import { formatDate } from '@/utils/format';

/** Payout requests of the community (billing/communities/<slug>/payouts/), most recent first */
function PayoutsTable({ payouts }: { payouts: CommunityPayout[] }) {
  const columns: ColumnDef<CommunityPayout>[] = [
    { id: 'date', header: 'Date', cell: ({ row }) => <span className="text-body">{formatDate(row.original.created_at)}</span> },
    {
      id: 'amount',
      header: () => <span className="block text-right">Montant</span>,
      cell: ({ row }) => <span className="block text-right font-semibold text-foreground tabular-nums">{xof(Number(row.original.amount))}</span>,
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const p = row.original;
        const style = payoutStatusStyle[p.status] ?? payoutStatusStyle.pending;
        return (
          <>
            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>
            {p.status === 'rejected' && p.rejection_reason && <span className="mt-1 block max-w-56 text-xs whitespace-normal text-red-700">{p.rejection_reason}</span>}
          </>
        );
      },
    },
    {
      id: 'method',
      header: 'Moyen',
      cell: ({ row }) => (
        <span className="text-body">
          {payoutMethodLabel[row.original.payment_method] ?? row.original.payment_method}
          <span className="block text-xs text-muted-foreground">{row.original.account_identifier}</span>
        </span>
      ),
    },
  ];

  return <DataTable columns={columns} data={payouts} isLoading={false} caption="Demandes de reversement" />;
}

export default PayoutsTable;
