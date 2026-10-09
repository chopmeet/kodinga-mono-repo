import { Check, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, cn } from '@kodinga-mono-repo/ui';
import type { SpacePlan } from '@/data/community-billing.data';
import { intervalLabel, xof } from '@/pages/shared/community-labels';
import { useSpaceBilling } from '../form/UseSpaceBilling';
import PlanModal from '../modals/plan-modal';

function PlansTab() {
  const { plans, savePlan, togglePlan } = useSpaceBilling();
  const [modal, setModal] = useState<{ open: boolean; plan: SpacePlan | null }>({ open: false, plan: null });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Les formules actives sont proposées aux membres qui rejoignent la communauté.</p>
        <Button onClick={() => setModal({ open: true, plan: null })}>
          <Plus />
          Nouvelle formule
        </Button>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.id}
            aria-label={`Formule ${plan.name}`}
            className={cn('flex flex-col rounded-xl border p-4', plan.is_active ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50')}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{plan.name}</h3>
              <Badge
                variant="outline"
                className={plan.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}
              >
                {plan.is_active ? 'Active' : 'Désactivée'}
              </Badge>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
              {xof(plan.price)} <span className="text-sm font-normal text-slate-500">{intervalLabel[plan.billing_interval].suffix}</span>
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
            <p className="mt-4 text-sm text-slate-500">
              <span className="font-semibold text-slate-900 tabular-nums">{plan.subscribers_count}</span> abonné
              {plan.subscribers_count > 1 ? 's' : ''} actif{plan.subscribers_count > 1 ? 's' : ''}
            </p>
            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
              <Button size="sm" variant="outline" onClick={() => setModal({ open: true, plan })}>
                <Pencil />
                Modifier
              </Button>
              <Button size="sm" variant="ghost" onClick={() => togglePlan(plan)}>
                {plan.is_active ? 'Désactiver' : 'Réactiver'}
              </Button>
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
