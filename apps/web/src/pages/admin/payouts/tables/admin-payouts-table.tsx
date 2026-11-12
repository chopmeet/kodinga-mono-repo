import type { ColumnDef } from '@tanstack/react-table';
import { Check, Send, X } from 'lucide-react';

import { Button, cn, DataTable, Tooltip, TooltipContent, TooltipTrigger } from '@kodinga/ui';
import { payoutMethodLabel, payoutStatusStyle, xof } from '@/utils/Utils';
import type { CommunityPayout } from '@/utils/api/billing/billing.type';
import { formatDate } from '@/utils/format';

type Props = {
  payouts: CommunityPayout[];
  isLoading: boolean;
  onApprove: (payout: CommunityPayout) => void;
  onReject: (payout: CommunityPayout) => void;
  onDisburse: (payout: CommunityPayout) => void;
};

export default function AdminPayoutsTable({ payouts, isLoading, onApprove, onReject, onDisburse }: Props) {
  const columns: ColumnDef<CommunityPayout>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => <span className="text-body text-xs whitespace-nowrap">{formatDate(row.original.created_at)}</span>,
    },
    {
      id: 'community',
      header: 'Communauté',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{p.community_name || 'N/A'}</span>
            <span className="text-xs text-muted-foreground">{p.requested_by_username ? `@${p.requested_by_username}` : ''}</span>
          </div>
        );
      },
    },
    {
      id: 'amount',
      header: () => <span className="block text-right">Brut</span>,
      cell: ({ row }) => (
        <span className="block text-right font-medium text-foreground tabular-nums">
          {xof(Number(row.original.amount))}
        </span>
      ),
    },
    {
      id: 'fees',
      header: () => <span className="block text-right">Frais (2%)</span>,
      cell: ({ row }) => {
        const fee = Number(row.original.fee_amount || Number(row.original.amount) * 0.02);
        return <span className="block text-right text-xs text-emerald-600 tabular-nums">+{xof(fee)}</span>;
      },
    },
    {
      id: 'net_amount',
      header: () => <span className="block text-right">Net à virer</span>,
      cell: ({ row }) => {
        const net = Number(row.original.net_amount || Number(row.original.amount) * 0.98);
        return (
          <span className="block text-right font-bold text-foreground tabular-nums">
            {xof(net)}
          </span>
        );
      },
    },
    {
      id: 'method',
      header: 'Bénéficiaire',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase text-foreground">
              {payoutMethodLabel[p.payment_method] || p.payment_method}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{p.account_identifier}</span>
            {p.account_name && <span className="text-[11px] text-muted-foreground">{p.account_name}</span>}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const p = row.original;
        const style = payoutStatusStyle[p.status] ?? payoutStatusStyle.pending;
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>
              {style.label}
            </span>
            {p.status === 'processed' && p.reference && (
              <span className="text-[11px] text-muted-foreground truncate max-w-32" title={p.reference}>
                Réf: {p.reference}
              </span>
            )}
            {p.status === 'rejected' && p.rejection_reason && (
              <span className="text-[11px] text-red-600 line-clamp-1 max-w-44" title={p.rejection_reason}>
                {p.rejection_reason}
              </span>
            )}
            {p.status === 'failed' && (
              <span className="text-[11px] text-red-600 line-clamp-1 max-w-44">
                Échec virement
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: () => <span className="block text-right">Actions</span>,
      cell: ({ row }) => {
        const p = row.original;
        const isActionable = p.status === 'pending' || p.status === 'approved';

        if (!isActionable) {
          return <span className="block text-right text-xs text-muted-foreground">—</span>;
        }

        return (
          <div className="flex items-center justify-end gap-1.5">
            {/* Direct PayDunya disbursement */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 px-2.5 text-xs gap-1"
                  onClick={() => onDisburse(p)}
                >
                  <Send className="size-3.5" />
                  <span>Virer</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exécuter le virement direct via PayDunya</TooltipContent>
            </Tooltip>

            {/* Approve button if pending */}
            {p.status === 'pending' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => onApprove(p)}
                  >
                    <Check className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Approuver la demande</TooltipContent>
              </Tooltip>
            )}

            {/* Reject button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onReject(p)}
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rejeter et rembourser le solde</TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return <DataTable columns={columns} data={payouts} isLoading={isLoading} caption="Demandes de reversement des créateurs" />;
}

