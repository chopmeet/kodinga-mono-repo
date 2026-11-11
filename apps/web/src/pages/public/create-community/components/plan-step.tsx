import { ArrowLeft, ArrowRight, Check, Crown, Gift, LoaderCircle, Lock } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, cn, Dialog, DialogContent, DialogDescription, DialogTitle } from '@kodinga/ui';
import { FormAlert } from '@/pages/auth/components/form-alert';
import { periodLabel, periodSuffix, xof } from '@/utils/Utils';
import type { CreateCommunityFlow } from '../form/UseCreateCommunity';

const FREE_FEATURES = ['freeFeature1', 'freeFeature2', 'freeFeatureLive', 'freeFeatureHackathons', 'freeFeatureJobs', 'freeFeature3', 'freeFeature4'] as const;
const PRO_FEATURES = ['proFeatureAll', 'proFeature1', 'proFeature2', 'proFeature3', 'proFeature4', 'proFeature5'] as const;

type FeatureKey = (typeof FREE_FEATURES)[number] | (typeof PRO_FEATURES)[number];

function Features({ keys }: { keys: readonly FeatureKey[] }) {
  const { t } = useTranslation();
  return (
    <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
      {keys.map((key) => (
        <li key={key} className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          {t(`create.plan.${key}`)}
        </li>
      ))}
    </ul>
  );
}

function PlanCard({ label, current, disabled, children }: { label: string; current: boolean; disabled: boolean; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className={cn(
        'flex flex-col rounded-2xl border bg-white p-6 shadow-sm',
        current ? 'border-brand ring-1 ring-brand' : 'border-slate-200',
        disabled && 'opacity-60'
      )}
    >
      {children}
    </section>
  );
}


export function PlanChooser({ flow }: { flow: CreateCommunityFlow }) {
  const { t } = useTranslation();
  const { plans, plansLoading, proOnly, payment } = flow.pro;
  const { formula, pro_plan_id } = flow.values;
  const { setValue, formState } = flow.form;
  const selected = plans.find((p) => p.id === pro_plan_id);
  const monthly = plans.find((p) => p.billing_interval === 'month');

  // A period chosen by default: the first one the api offers (monthly)
  useEffect(() => {
    if (plans.length && !plans.some((p) => p.id === pro_plan_id)) setValue('pro_plan_id', plans[0].id);
  }, [plans, pro_plan_id, setValue]);

  const saving = (yearly: number) => (monthly ? Number(monthly.price) * 12 - yearly : 0);
  const proUnavailable = !plansLoading && plans.length === 0;
  const busy = flow.isSubmitting;
  // Until a plan is chosen, the only ways out are the two plans (or "Quitter" on the page)
  const locked = !flow.planChosen;
  const failedPayment = payment === 'cancelled' || payment === 'failed';

  return (
    <Dialog open={flow.planOpen} onOpenChange={(open) => !open && !locked && !busy && flow.closePlan()}>
      <DialogContent
        position="top"
        showCloseButton={!locked}
        onEscapeKeyDown={(e) => locked && e.preventDefault()}
        onInteractOutside={(e) => locked && e.preventDefault()}
        className="gap-0 bg-slate-50 p-5 sm:max-w-4xl sm:p-10"
      >
        {/* The page's "Quitter" is behind the chooser: the same way out, until a plan is chosen */}
        {locked && (
          <Link to="/" className="mb-2 inline-flex items-center gap-2 self-start rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900">
            <ArrowLeft className="size-4" />
            {t('create.page.quit')}
          </Link>
        )}
        <div className="text-center">
          <DialogTitle className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-4xl">{t('create.headings.planTitle')}</DialogTitle>
          <DialogDescription className="mt-3 text-[15px] text-slate-600">{t('create.headings.planSubtitle')}</DialogDescription>
        </div>

        {failedPayment && (
          <p role="status" className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {t(`create.payment.${payment}`)}
          </p>
        )}
        {flow.formError && (
          <div className="mt-6">
            <FormAlert>{flow.formError}</FormAlert>
          </div>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <PlanCard label={t('create.plan.free')} current={!locked && formula === 'free'} disabled={proOnly}>
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <Gift className="size-4 text-slate-600" aria-hidden />
              {t('create.plan.free')}
            </h3>
            <p className="mt-1 text-3xl font-bold text-slate-900">{xof(0)}</p>
            {proOnly ? <p className="mt-4 flex-1 text-sm text-slate-500">{t('create.plan.proOnly')}</p> : <Features keys={FREE_FEATURES} />}
            <Button type="button" variant="outline" className="mt-6 h-12 w-full" disabled={proOnly || busy} onClick={() => flow.confirmPlan('free')}>
              {t('create.plan.startFree')}
            </Button>
          </PlanCard>

          <PlanCard label={t('create.plan.pro')} current={!locked && formula === 'pro'} disabled={proUnavailable}>
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <Crown className="size-4 text-amber-500" aria-hidden />
              {t('create.plan.pro')}
            </h3>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {plansLoading ? '…' : selected ? xof(Number(selected.price)) : '—'}
              {selected && <span className="ml-1 text-sm font-medium text-slate-500">{periodSuffix(selected.billing_interval, true)}</span>}
            </p>

            {proUnavailable ? (
              <p className="mt-4 flex-1 text-sm text-slate-500">{t('create.plan.unavailable')}</p>
            ) : (
              <>
                <div role="radiogroup" aria-label={t('create.plan.period')} className="mt-4 flex flex-wrap gap-2">
                  {plans.map((p) => {
                    const active = p.id === pro_plan_id;
                    const off = p.billing_interval === 'year' ? saving(Number(p.price)) : 0;
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                          'has-focus-visible:ring-4 has-focus-visible:ring-brand/25',
                          active ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        )}
                      >
                        <input
                          type="radio"
                          name="pro_plan_id"
                          value={p.id}
                          className="sr-only"
                          checked={active}
                          onChange={() => setValue('pro_plan_id', p.id, { shouldDirty: true })}
                        />
                        {periodLabel(p.billing_interval, true)}
                        {off > 0 && <span className={cn('ml-1.5 text-xs', active ? 'text-white/85' : 'text-emerald-700')}>−{xof(off)}</span>}
                      </label>
                    );
                  })}
                </div>
                {selected?.billing_interval === 'year' && saving(Number(selected.price)) > 0 && (
                  <p className="mt-2 text-sm text-emerald-700">{t('create.plan.saving', { amount: xof(saving(Number(selected.price))) })}</p>
                )}
                <Features keys={PRO_FEATURES} />
              </>
            )}
            {formState.errors.pro_plan_id?.message && <p className="mt-2 text-sm text-red-600">{formState.errors.pro_plan_id.message}</p>}
            <Button type="button" className="mt-6 h-12 w-full" disabled={proUnavailable || busy || !selected} onClick={() => flow.confirmPlan('pro')}>
              {busy ? (
                <>
                  <LoaderCircle className="size-4.5 animate-spin" />
                  {t('create.page.redirecting')}
                </>
              ) : flow.paysFromPlan ? (
                <>
                  <Lock className="size-4.5" />
                  {t('create.page.pay')}
                </>
              ) : (
                <>
                  {t('create.plan.continuePro')}
                  <ArrowRight className="size-4.5" />
                </>
              )}
            </Button>
          </PlanCard>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">{t('create.plan.proNext')}</p>
      </DialogContent>
    </Dialog>
  );
}
