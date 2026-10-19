import { Check, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button, Loader } from '@kodinga-mono-repo/ui';
import type { CommunityPlan } from '@/utils/api/billing/billing.type';
import { intervalLabel, xof } from '@/pages/shared/community-labels';
import { useSpaceBilling } from '../form/UseSpaceBilling';
import PlanModal from '../modals/plan-modal';

function PlansTab() {
  const { plans, isLoading, savePlan, removePlan } = useSpaceBilling();
  const [modal, setModal] = useState<{ open: boolean; plan: CommunityPlan | null }>({ open: false, plan: null });
  const [confirming, setConfirming] = useState<string | null>(null);

  if (isLoading) return <Loader inline size="sm" message="Chargement des formules…" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Ces formules sont proposées aux membres qui rejoignent la communauté.</p>
        <Button onClick={() => setModal({ open: true, plan: null })}>
          <Plus />
          Nouvelle formule
        </Button>
      </div>

      {plans.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Aucune formule : créez-en une pour que les membres puissent rejoindre la communauté.</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <li key={plan.id} aria-label={`Formule ${plan.name}`} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">{plan.name}</h3>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
              {xof(Number(plan.price))} <span className="text-sm font-normal text-slate-500">{intervalLabel[plan.billing_interval].suffix}</span>
            </p>
            {plan.description && <p className="mt-1 text-sm text-slate-600">{plan.description}</p>}
            {plan.features.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button size="sm" variant="outline" onClick={() => setModal({ open: true, plan })}>
                <Pencil />
                Modifier
              </Button>
              {confirming === plan.id ? (
                <>
                  <Button size="sm" variant="danger" onClick={() => removePlan(plan).then(() => setConfirming(null))}>
                    Confirmer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                    Annuler
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirming(plan.id)}>
                  Ne plus proposer
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <PlanModal
        open={modal.open}
        plan={modal.plan}
        existingNames={plans.map((p) => p.name)}
        onOpenChange={(open) => setModal((m) => ({ ...m, open }))}
        onSave={savePlan}
      />
    </div>
  );
}

export default PlansTab;
