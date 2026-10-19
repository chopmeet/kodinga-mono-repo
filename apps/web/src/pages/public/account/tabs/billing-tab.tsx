import { CreditCard, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn, Loader } from '@kodinga-mono-repo/ui';
import { intervalLabel, paymentStatusStyle, subscriptionStatusStyle, xof } from '@/pages/shared/community-labels';
import { useGetMyPaymentsQuery, useGetMySubscriptionsQuery } from '@/utils/api/community/community.api';

const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const amountOf = (value: string, currency: string) => (currency === 'XOF' ? xof(Number(value)) : `${Number(value).toLocaleString('fr-FR')} ${currency}`);

/** /account/billing — the memberships paid by the user (PayDunya) and their payments */
function BillingTab() {
  const subscriptions = useGetMySubscriptionsQuery();
  const payments = useGetMyPaymentsQuery();

  if (subscriptions.isLoading || payments.isLoading) return <Loader inline size="sm" message="Chargement de vos abonnements…" />;

  const subs = subscriptions.data ?? [];
  const history = payments.data ?? [];

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="subscriptions-title">
        <h2 id="subscriptions-title" className="flex items-center gap-2 font-semibold text-slate-900">
          <CreditCard className="size-5 text-blue-900" /> Mes abonnements
        </h2>
        {subs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Aucun abonnement. Les communautés payantes vous proposent leurs formules au moment de les rejoindre.{' '}
            <Link to="/" className="font-semibold text-blue-900 hover:underline">
              Explorer les communautés
            </Link>
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Mes abonnements">
            {subs.map((s) => {
              const style = subscriptionStatusStyle[s.status] ?? subscriptionStatusStyle.expired;
              const oneTime = s.plan?.billing_interval === 'one_time';
              return (
                <li key={s.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{s.plan?.community_name ?? 'Communauté'}</p>
                      <p className="text-sm text-slate-600">
                        {s.plan?.name}
                        {s.plan && ` · ${amountOf(s.plan.price, s.plan.currency)} ${intervalLabel[s.plan.billing_interval]?.suffix ?? ''}`}
                      </p>
                    </div>
                    <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    {oneTime
                      ? 'Accès à vie'
                      : s.cancel_at_period_end || s.status === 'canceled'
                        ? `Accès jusqu’au ${day.format(new Date(s.current_period_end))}`
                        : s.is_active
                          ? `Renouvellement le ${day.format(new Date(s.current_period_end))}`
                          : `Terminé le ${day.format(new Date(s.current_period_end))}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="payments-title">
        <h2 id="payments-title" className="flex items-center gap-2 font-semibold text-slate-900">
          <Receipt className="size-5 text-blue-900" /> Historique des paiements
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucun paiement pour le moment.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Historique des paiements</caption>
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Formule</th>
                  <th className="px-4 py-3 text-right font-semibold">Montant</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((p) => {
                  const style = paymentStatusStyle[p.status] ?? paymentStatusStyle.PENDING;
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{day.format(new Date(p.paid_at ?? p.created_at))}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {p.plan?.community_name && <span className="block font-medium text-slate-900">{p.plan.community_name}</span>}
                        {p.plan?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">{amountOf(p.amount, p.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>
                        {p.status === 'PENDING' && /^https:\/\//.test(p.checkout_url) && (
                          <a href={p.checkout_url} className="ml-2 text-xs font-semibold text-blue-900 hover:underline">
                            Finaliser
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Paiements sécurisés par PayDunya (Orange Money, Wave, MTN MoMo, Moov Money, carte).</p>
      </section>
    </div>
  );
}

export default BillingTab;
