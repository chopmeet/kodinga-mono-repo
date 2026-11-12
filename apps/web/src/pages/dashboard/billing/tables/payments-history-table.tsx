import type { ColumnDef } from '@tanstack/react-table';

import { Button, cn, DataTable } from '@kodinga/ui';
import { amountOf, paymentStatusStyle } from '@/utils/Utils';
import type { MyPayment } from '@/utils/api/billing/billing.type';
import { formatLongDate } from '@/utils/format';

type Props = {
  payments: MyPayment[];
  /** Id of the payment being checked with PayDunya */
  verifyingId: string | null;
  onFinalize: (paymentId: string) => void;
};

/** The payments of the user, most recent first; a pending one can be checked again or reopened */
function PaymentsHistoryTable({ payments, verifyingId, onFinalize }: Props) {
  const columns: ColumnDef<MyPayment>[] = [
    { id: 'date', header: 'Date', cell: ({ row }) => <span className="text-body">{formatLongDate(row.original.paid_at ?? row.original.created_at)}</span> },
    {
      id: 'amount',
      header: () => <span className="block text-right">Montant</span>,
      cell: ({ row }) => <span className="block text-right font-medium text-foreground tabular-nums">{amountOf(row.original.amount, row.original.currency)}</span>,
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const p = row.original;
        const style = paymentStatusStyle[p.status] ?? paymentStatusStyle.PENDING;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>
            {p.status === 'PENDING' && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 bg-emerald-600 px-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                  isLoading={verifyingId === p.id}
                  onClick={() => onFinalize(p.id)}
                  title="Valider la facture réglée auprès de PayDunya"
                >
                  Finaliser le paiement
                </Button>
                {/^https:\/\//.test(p.checkout_url) && (
                  <a
                    href={p.checkout_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    title="Rouvrir la page PayDunya si vous n'aviez pas encore payé"
                  >
                    Finaliser
                  </a>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'plan',
      header: 'Formule',
      cell: ({ row }) => (
        <span className="text-body">
          {row.original.plan?.community_name && <span className="block font-medium text-foreground">{row.original.plan.community_name}</span>}
          {row.original.plan?.name ?? '—'}
        </span>
      ),
    },
  ];

  return <DataTable columns={columns} data={payments} isLoading={false} caption="Historique des paiements" />;
}

export default PaymentsHistoryTable;
