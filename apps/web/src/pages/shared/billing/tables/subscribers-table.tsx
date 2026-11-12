import type { ColumnDef } from '@tanstack/react-table';

import { cn, DataTable, Loader } from '@kodinga/ui';
import { intervalLabel, subscriptionStatusStyle, xof } from '@/utils/Utils';
import { parseApiError } from '@/utils/api/errors';
import type { CommunitySubscriber } from '@/utils/api/billing/billing.type';
import { formatDate } from '@/utils/format';
import type { BillingQuery } from '../billing-query';

const columns: ColumnDef<CommunitySubscriber>[] = [
  {
    id: 'member',
    header: 'Membre',
    cell: ({ row }) => (
      <>
        <span className="block font-medium text-foreground">{row.original.user.full_name}</span>
        <span className="text-xs text-muted-foreground">@{row.original.user.username}</span>
      </>
    ),
  },
  {
    id: 'status',
    header: 'Statut',
    cell: ({ row }) => {
      const s = row.original;
      const style = subscriptionStatusStyle[s.status] ?? subscriptionStatusStyle.expired;
      return (
        <>
          <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>
          {s.cancel_at_period_end && s.status === 'active' && <span className="mt-1 block text-xs text-muted-foreground">Ne sera pas renouvelé</span>}
        </>
      );
    },
  },
  {
    id: 'plan',
    header: 'Formule',
    cell: ({ row }) => {
      const { plan } = row.original;
      return (
        <span className="text-body">
          {plan.name}
          <span className="block text-xs text-muted-foreground">
            {xof(Number(plan.price))} {intervalLabel[plan.billing_interval]?.suffix}
          </span>
        </span>
      );
    },
  },
  {
    id: 'period_end',
    header: 'Échéance',
    cell: ({ row }) => (
      <span className="text-body">{row.original.plan.billing_interval === 'one_time' ? 'Accès à vie' : formatDate(row.original.current_period_end)}</span>
    ),
  },
];

/** Subscriptions to the plans of a community (billing/communities/<slug>/subscribers/), most recent first */
function SubscribersTable({ query: subscribers }: { query: BillingQuery<CommunitySubscriber[]> }) {
  if (subscribers.isLoading) return <Loader inline size="sm" message="Chargement des abonnés…" />;
  if (subscribers.error) return <p className="text-sm text-red-700">{parseApiError(subscribers.error).message}</p>;

  const list = subscribers.data ?? [];
  if (list.length === 0) {
    return <p className="rounded-xl border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">Aucun abonné pour l’instant : ils apparaîtront ici dès leur premier paiement.</p>;
  }

  return <DataTable columns={columns} data={list} isLoading={false} caption="Abonnés de la communauté" />;
}

export default SubscribersTable;
