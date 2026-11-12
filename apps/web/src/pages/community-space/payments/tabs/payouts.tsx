import { Banknote } from 'lucide-react';
import { useState } from 'react';

import { Button, Loader } from '@kodinga/ui';
import { xof } from '@/utils/Utils';
import { parseApiError } from '@/utils/api/errors';
import { MIN_PAYOUT, useSpaceBilling } from '../form/UseSpaceBilling';
import PayoutModal from '../modals/payout-modal';
import PayoutsTable from '../tables/payouts-table';

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
      <section aria-label="Solde" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-subtle p-4">
        <div>
          <p className="text-sm text-muted-foreground">Solde disponible</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{xof(balance)}</p>
          {revenue.data && <p className="mt-1 text-xs text-muted-foreground">Déjà reversé : {xof(Number(revenue.data.withdrawn_amount))}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => setOpen(true)} disabled={balance < MIN_PAYOUT}>
            <Banknote />
            Demander un reversement
          </Button>
          {balance < MIN_PAYOUT && <p className="text-xs text-muted-foreground">À partir de {xof(MIN_PAYOUT)} disponibles</p>}
        </div>
      </section>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">Aucune demande de reversement pour l’instant.</p>
      ) : (
        <PayoutsTable payouts={list} />
      )}

      <PayoutModal open={open} balance={balance} onOpenChange={setOpen} onRequest={requestPayout} />
    </div>
  );
}

export default PayoutsTab;
