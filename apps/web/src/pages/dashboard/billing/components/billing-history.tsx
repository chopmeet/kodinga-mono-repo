import { CreditCard, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, cn, customToast, Loader } from '@kodinga/ui';
import { intervalLabel, paymentStatusStyle, subscriptionStatusStyle, xof } from '@/utils/Utils';
import {
  useCancelSubscriptionMutation,
  useGetMyPaymentsQuery,
  useGetMySubscriptionsQuery,
  useVerifyPaymentMutation,
} from '@/utils/api/community/community.api';
import type { MySubscription } from '@/utils/api/billing/billing.type';
import { parseApiError } from '@/utils/api/errors';

const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const amountOf = (value: string, currency: string) => (currency === 'XOF' ? xof(Number(value)) : `${Number(value).toLocaleString('fr-FR')} ${currency}`);

/** The memberships paid by the user (PayDunya) and their payments */
function BillingHistory() {
  const subscriptions = useGetMySubscriptionsQuery();
  const payments = useGetMyPaymentsQuery();
  const [cancelSubscription, { isLoading: isCanceling }] = useCancelSubscriptionMutation();
  const [verifyPayment] = useVerifyPaymentMutation();
  // Two steps: the first click asks to confirm, on the card itself
  const [confirming, setConfirming] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleFinalize = async (paymentId: string) => {
    setVerifyingId(paymentId);
    try {
      const res = await verifyPayment({ paymentId, force: true }).unwrap();
      if (res.is_paid || res.status === 'PAID') {
        customToast.success({
          message: 'Paiement validé avec succès ! Votre abonnement est maintenant actif.',
        });
      } else {
        customToast.info({
          message: 'La confirmation auprès de l’opérateur est toujours en cours.',
        });
      }
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    } finally {
      setVerifyingId(null);
    }
  };

  const cancel = async (s: MySubscription) => {
    try {
      await cancelSubscription(s.id).unwrap();
      customToast.success({ message: `Abonnement résilié : vous gardez l’accès jusqu’au ${day.format(new Date(s.current_period_end))}.` });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    } finally {
      setConfirming(null);
    }
  };

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
                  {/* Renewable and not already stopped: the member can end it at the end of the period */}
                  {s.status === 'active' && s.is_active && !oneTime && !s.cancel_at_period_end && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {confirming === s.id ? (
                        <>
                          <span className="text-sm text-slate-600">Résilier ? L’accès reste ouvert jusqu’à l’échéance.</span>
                          <Button size="sm" variant="danger" isLoading={isCanceling} onClick={() => cancel(s)}>
                            Confirmer
                          </Button>
                          <Button size="sm" variant="outline" disabled={isCanceling} onClick={() => setConfirming(null)}>
                            Garder
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setConfirming(s.id)} aria-label={`Se désabonner de ${s.plan?.community_name ?? s.plan?.name ?? 'cet abonnement'}`}>
                          Se désabonner
                        </Button>
                      )}
                    </div>
                  )}
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>
                          {p.status === 'PENDING' && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                isLoading={verifyingId === p.id}
                                onClick={() => handleFinalize(p.id)}
                                title="Valider la facture réglée auprès de PayDunya"
                              >
                                Finaliser le paiement
                              </Button>
                              {/^https:\/\//.test(p.checkout_url) && (
                                <a
                                  href={p.checkout_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                                  title="Rouvrir la page PayDunya si vous n'aviez pas encore payé"
                                >
                                  Rouvrir PayDunya
                                </a>
                              )}
                            </div>
                          )}
                        </div>
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

export default BillingHistory;
