import { Banknote } from 'lucide-react';
import { useState } from 'react';

import { Button, cn, Loader } from '@kodinga/ui';
import { payoutMethodLabel, payoutStatusStyle, xof } from '@/utils/Utils';
import { parseApiError } from '@/utils/api/errors';
import { MIN_PAYOUT, useSpaceBilling } from '../form/UseSpaceBilling';
import PayoutModal from '../modals/payout-modal';

const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Available balance of the community and the payout requests (billing/communities/<slug>/payouts/) */
function PayoutsTab() {
  const { revenue, payouts, requestPayout } = useSpaceBilling();
  const [open, setOpen] = useState(false);

  if (revenue.isLoading || payouts.isLoading) return <Loader inline size="sm" message="Chargement des reversements…" />;
  if (revenue.error) return <p className="text-sm text-red-700">{parseApiError(revenue.error).message}</p>;

  const balance = Number(revenue.data?.available_balance ?? 0);
  const list = payouts.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Solde" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm text-slate-500">Solde disponible</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{xof(balance)}</p>
          {revenue.data && <p className="mt-1 text-xs text-slate-500">Déjà reversé : {xof(Number(revenue.data.withdrawn_amount))}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => setOpen(true)} disabled={balance < MIN_PAYOUT}>
            <Banknote />
            Demander un reversement
          </Button>
          {balance < MIN_PAYOUT && <p className="text-xs text-slate-500">À partir de {xof(MIN_PAYOUT)} disponibles</p>}
        </div>
      </section>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Aucune demande de reversement pour l’instant.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Demandes de reversement</caption>
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 text-right font-semibold">Montant</th>
                <th className="px-4 py-3 font-semibold">Moyen</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((p) => {
                const style = payoutStatusStyle[p.status] ?? payoutStatusStyle.pending;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{day.format(new Date(p.created_at))}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">{xof(Number(p.amount))}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {payoutMethodLabel[p.payment_method] ?? p.payment_method}
                      <span className="block text-xs text-slate-500">{p.account_identifier}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.className)}>{style.label}</span>
                      {p.status === 'rejected' && p.rejection_reason && <span className="mt-1 block text-xs text-red-700">{p.rejection_reason}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PayoutModal open={open} balance={balance} onOpenChange={setOpen} onRequest={requestPayout} />
    </div>
  );
}

export default PayoutsTab;
