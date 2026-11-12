import type { ColumnDef } from '@tanstack/react-table';

import { cn, DataTable, Loader } from '@kodinga/ui';
import { paymentStatusStyle, xof } from '@/utils/Utils';
import { parseApiError } from '@/utils/api/errors';
import type { CommunityTransaction } from '@/utils/api/billing/billing.type';
import { formatDate } from '@/utils/format';
import type { BillingQuery } from '../billing-query';

const right = (label: string) => () => <span className="block text-right">{label}</span>;

const columns: ColumnDef<CommunityTransaction>[] = [
  { id: 'date', header: 'Date', cell: ({ row }) => <span className="text-body">{formatDate(row.original.paid_at ?? row.original.created_at)}</span> },
  { id: 'member', header: 'Membre', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.user.full_name}</span> },
  {
    id: 'net',
    header: right('Net'),
    cell: ({ row }) => (
      <span className="block text-right font-semibold text-foreground tabular-nums">{row.original.status === 'PAID' ? xof(Number(row.original.net_amount)) : '—'}</span>
    ),
  },
  {
    id: 'status',
    header: 'Statut',
    cell: ({ row }) => {
      const style = paymentStatusStyle[row.original.status] ?? paymentStatusStyle.PENDING;
      return <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>;
    },
  },
  { id: 'plan', header: 'Formule', cell: ({ row }) => <span className="text-body">{row.original.plan_name}</span> },
  { id: 'amount', header: right('Montant'), cell: ({ row }) => <span className="block text-right text-foreground tabular-nums">{xof(Number(row.original.amount))}</span> },
  {
    id: 'fee',
    header: right('Commission'),
    cell: ({ row }) => (
      <span className="block text-right text-muted-foreground tabular-nums">{row.original.status === 'PAID' ? `− ${xof(Number(row.original.platform_fee))}` : '—'}</span>
    ),
  },
];

/**
 * Payments made on the plans of a community (billing/communities/<slug>/transactions/): what the
 * member paid, the Kodinga commission and the net for the owner (set once paid)
 */
function TransactionsTable({ query: transactions }: { query: BillingQuery<CommunityTransaction[]> }) {
  if (transactions.isLoading) return <Loader inline size="sm" message="Chargement des paiements…" />;
  if (transactions.error) return <p className="text-sm text-red-700">{parseApiError(transactions.error).message}</p>;

  const list = transactions.data ?? [];
  if (list.length === 0) {
    return <p className="rounded-xl border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">Aucun paiement reçu pour l’instant.</p>;
  }

  return <DataTable columns={columns} data={list} isLoading={false} caption="Paiements reçus" />;
}

export default TransactionsTable;
