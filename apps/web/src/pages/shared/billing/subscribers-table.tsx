import { cn, Loader } from '@kodinga/ui';
import { intervalLabel, subscriptionStatusStyle, xof } from '@/utils/Utils';
import { parseApiError } from '@/utils/api/errors';
import type { CommunitySubscriber } from '@/utils/api/billing/billing.type';
import type { BillingQuery } from './billing-query';

const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Subscriptions to the plans of a community (billing/communities/<slug>/subscribers/), most recent first */
function SubscribersTable({ query: subscribers }: { query: BillingQuery<CommunitySubscriber[]> }) {
  if (subscribers.isLoading) return <Loader inline size="sm" message="Chargement des abonnés…" />;
  if (subscribers.error) return <p className="text-sm text-red-700">{parseApiError(subscribers.error).message}</p>;

  const list = subscribers.data ?? [];
  if (list.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Aucun abonné pour l’instant : ils apparaîtront ici dès leur premier paiement.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Abonnés de la communauté</caption>
        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Membre</th>
            <th className="px-4 py-3 font-semibold">Formule</th>
            <th className="px-4 py-3 font-semibold">Statut</th>
            <th className="px-4 py-3 font-semibold">Échéance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((s) => {
            const style = subscriptionStatusStyle[s.status] ?? subscriptionStatusStyle.expired;
            const oneTime = s.plan.billing_interval === 'one_time';
            return (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <span className="block font-medium text-slate-900">{s.user.full_name}</span>
                  <span className="text-xs text-slate-500">@{s.user.username}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {s.plan.name}
                  <span className="block text-xs text-slate-500">
                    {xof(Number(s.plan.price))} {intervalLabel[s.plan.billing_interval]?.suffix}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>
                  {s.cancel_at_period_end && s.status === 'active' && <span className="mt-1 block text-xs text-slate-500">Ne sera pas renouvelé</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{oneTime ? 'Accès à vie' : day.format(new Date(s.current_period_end))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default SubscribersTable;
