import { cn, Loader } from '@kodinga/ui';
import { paymentStatusStyle, xof } from '@/utils/Utils';
import { parseApiError } from '@/utils/api/errors';
import type { CommunityTransaction } from '@/utils/api/billing/billing.type';
import type { BillingQuery } from './billing-query';

const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Payments made on the plans of a community (billing/communities/<slug>/transactions/): what the
 * member paid, the Kodinga commission and the net for the owner (set once paid)
 */
function TransactionsTable({ query: transactions }: { query: BillingQuery<CommunityTransaction[]> }) {
  if (transactions.isLoading) return <Loader inline size="sm" message="Chargement des paiements…" />;
  if (transactions.error) return <p className="text-sm text-red-700">{parseApiError(transactions.error).message}</p>;

  const list = transactions.data ?? [];
  if (list.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Aucun paiement reçu pour l’instant.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <caption className="sr-only">Paiements reçus</caption>
        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">Membre</th>
            <th className="px-4 py-3 font-semibold">Formule</th>
            <th className="px-4 py-3 text-right font-semibold">Montant</th>
            <th className="px-4 py-3 text-right font-semibold">Commission</th>
            <th className="px-4 py-3 text-right font-semibold">Net</th>
            <th className="px-4 py-3 font-semibold">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((p) => {
            const style = paymentStatusStyle[p.status] ?? paymentStatusStyle.PENDING;
            const paid = p.status === 'PAID';
            return (
              <tr key={p.id}>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{day.format(new Date(p.paid_at ?? p.created_at))}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{p.user.full_name}</td>
                <td className="px-4 py-3 text-slate-700">{p.plan_name}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-slate-900 tabular-nums">{xof(Number(p.amount))}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-slate-500 tabular-nums">{paid ? `− ${xof(Number(p.platform_fee))}` : '—'}</td>
                <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">{paid ? xof(Number(p.net_amount)) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default TransactionsTable;
