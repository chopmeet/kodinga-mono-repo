import { Check, CircleCheck, CircleX, Clock, Crown, LoaderCircle } from 'lucide-react';

import { Badge, Button, cn } from '@kodinga/ui';
import { periodSuffix, xof } from '@/utils/Utils';
import { parseApiError } from '@/utils/api/errors';
import { formatLongDate } from '@/utils/format';
import type { KodingaPro } from '../form/UseKodingaPro';

const notices = {
  checking: { icon: <LoaderCircle className="size-4 shrink-0 animate-spin" />, className: 'border-blue-200 bg-blue-50 text-blue-950', text: 'Vérification de votre paiement auprès de PayDunya…' },
  paid: { icon: <CircleCheck className="size-4 shrink-0" />, className: 'border-emerald-200 bg-emerald-50 text-emerald-900', text: 'Paiement confirmé : vous êtes membre Pro !' },
  pending: {
    icon: <Clock className="size-4 shrink-0" />,
    className: 'border-amber-200 bg-amber-50 text-amber-900',
    text: 'Paiement en attente de confirmation : Pro s’activera dès que PayDunya l’aura validé.',
  },
  failed: { icon: <CircleX className="size-4 shrink-0" />, className: 'border-red-200 bg-red-50 text-red-900', text: 'Le paiement n’a pas abouti : vous n’avez pas été débité. Vous pouvez réessayer.' },
  cancelled: { icon: <CircleX className="size-4 shrink-0" />, className: 'border-slate-200 bg-white text-slate-700', text: 'Paiement annulé : vous n’avez pas été débité.' },
} as const;

/** /dashboard/billing — Kodinga Pro: the user's status, then the plans with their PayDunya checkout */
export function ProPlans({ pro }: { pro: KodingaPro }) {
  const notice = pro.payment ? notices[pro.payment] : null;

  return (
    <section aria-labelledby="kodinga-pro">
      <div className="flex flex-wrap items-center gap-2">
        <Crown className="size-5 text-amber-500" aria-hidden />
        <h2 id="kodinga-pro" className="text-lg font-semibold text-slate-900">
          Kodinga Pro
        </h2>
        {pro.isPro && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Membre Pro</Badge>}
      </div>
      <p className="mt-1 text-sm text-slate-500">Rendez vos communautés payantes et créez vos formules d’adhésion.</p>

      {notice && (
        <p className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${notice.className}`} role="status">
          {notice.icon}
          {notice.text}
          {pro.payment === 'pending' && (
            <a href="#subscriptions-title" className="ml-auto shrink-0 font-semibold underline">
              Voir
            </a>
          )}
        </p>
      )}

      {pro.subscription && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Formule {pro.subscription.plan.name} :{' '}
          {pro.subscription.cancel_at_period_end ? 'se termine' : 'renouvelée'} le {formatLongDate(pro.subscription.current_period_end)}.{' '}
          <a href="#subscriptions-title" className="font-semibold underline">
            Gérer
          </a>
        </p>
      )}

      {pro.isLoading ? (
        <p className="mt-4 text-sm text-slate-500" role="status">
          Chargement des formules Pro…
        </p>
      ) : pro.error ? (
        <p className="mt-4 text-sm text-red-700">{parseApiError(pro.error).message}</p>
      ) : pro.plans.length === 0 ? (
        !pro.isPro && <p className="mt-4 text-sm text-slate-500">Les formules Pro ne sont pas encore ouvertes.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2" aria-label="Formules Pro">
          {pro.plans.map((plan) => {
            const current = pro.subscription?.plan.id === plan.id;
            return (
              <li key={plan.id} className={cn('flex flex-col rounded-xl border bg-white p-5', current ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200')}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-slate-900">{plan.name}</p>
                  {current && <Badge variant="outline">Votre formule</Badge>}
                </div>
                <p className="mt-2">
                  <span className="text-2xl font-bold text-slate-900">{xof(Number(plan.price))}</span>{' '}
                  <span className="text-sm text-slate-500">{periodSuffix(plan.billing_interval, true)}</span>
                </p>
                {plan.description && <p className="mt-2 text-sm text-slate-500">{plan.description}</p>}
                {plan.features.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
                {!current && (
                  <Button
                    className="mt-5 w-full"
                    disabled={!!pro.checkingOut}
                    isLoading={pro.checkingOut === plan.id}
                    onClick={() => pro.subscribe(plan.id)}
                  >
                    {pro.isPro ? `Passer à ${plan.name}` : `Devenir Pro — ${plan.name}`}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
