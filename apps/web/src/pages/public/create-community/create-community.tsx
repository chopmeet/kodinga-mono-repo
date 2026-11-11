import { ArrowLeft, ArrowRight, Check, CircleCheck, CircleX, Clock, LoaderCircle, Lock, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type ReactNode, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { Button, cn } from '@kodinga/ui';
import { Logo } from '@/layouts/components/header';
import { FormAlert } from '@/pages/auth/components/form-alert';
import type { PaymentReturn } from '@/pages/public/community/form/UsePaymentReturn';
import { useGetCommunityCategoriesQuery } from '@/utils/api/community/community.api';
import { planPrice } from '@/utils/Utils';
import { CommunityPreview } from './components/community-preview';
import { AccessStep, AccountStep, LookStep, NameStep, TopicStep } from './components/steps';
import { AIWizardModal } from './components/ai-wizard-modal';
import { PlanChooser } from './components/plan-step';
import UseCreateCommunity from './form/UseCreateCommunity';


const notices: Record<Exclude<PaymentReturn, null>, { icon: ReactNode; className: string }> = {
  checking: { icon: <LoaderCircle className="size-4 shrink-0 animate-spin" />, className: 'border-blue-200 bg-blue-50 text-blue-950' },
  paid: { icon: <CircleCheck className="size-4 shrink-0" />, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  pending: { icon: <Clock className="size-4 shrink-0" />, className: 'border-amber-200 bg-amber-50 text-amber-900' },
  failed: { icon: <CircleX className="size-4 shrink-0" />, className: 'border-red-200 bg-red-50 text-red-900' },
  cancelled: { icon: <CircleX className="size-4 shrink-0" />, className: 'border-slate-200 bg-white text-slate-700' },
};

/**
 * /create-community — Skool-like creation flow, open to visitors: the plan chooser first, over the
 * flow (free, or Kodinga Pro paid on PayDunya before the steps), then name, topic, access, look;
 * the account is asked first for Pro, at the end otherwise.
 */
function CreateCommunity() {
  const { t } = useTranslation();
  const flow = UseCreateCommunity();
  const { data: categories = [], isLoading: categoriesLoading } = useGetCommunityCategoriesQuery();
  // The account asked before paying Pro is not the last step: its own heading
  const headingId = flow.step.id === 'account' && !flow.isLast ? 'accountPro' : flow.step.id;
  const heading = {
    title: t(`create.headings.${headingId}Title`),
    subtitle: t(`create.headings.${headingId}Subtitle`),
  };
  const titleRef = useRef<HTMLHeadingElement>(null);
  const category = categories.find((c) => c.id === flow.values.category_id);

  // Each step announces itself (keyboard and screen reader users land on the new question)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [flow.step.id]);

  // The name step waits for a usable name, like in the design (the button lights up once it is typed)
  const canContinue = flow.step.id !== 'name' || flow.values.name.trim().length >= 3;
  const payment = flow.pro.payment;
  // Cancelled or failed: told in the plan chooser, which opens again
  const notice = payment && payment !== 'cancelled' && payment !== 'failed' ? notices[payment] : null;
  const proPlan = flow.pro.plans.find((p) => p.id === flow.values.pro_plan_id);
  // Pro members never choose: no recap for them
  const showsPlan = flow.planChosen && !flow.pro.isPro;

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="mx-auto flex h-24 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 font-medium text-slate-700 hover:bg-white hover:text-slate-900">
          <ArrowLeft className="size-4.5" />
          {t('create.page.quit')}
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-8 px-4 pt-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-10">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (canContinue) flow.next();
          }}
          className="rounded-2xl bg-white p-6 shadow-sm sm:p-10"
        >
          {/* One segment per step: done and current steps are filled */}
          <div className="flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={flow.steps.length} aria-valuenow={flow.index + 1} aria-label={t('create.page.progress')}>
            {flow.steps.map((s, i) => (
              <span key={s.id} className={cn('h-1 flex-1 rounded-full transition-colors', i <= flow.index ? 'bg-blue-800' : 'bg-slate-200')} />
            ))}
          </div>

          {payment && notice && (
            <p role="status" className={cn('mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm', notice.className)}>
              {notice.icon}
              {t(`create.payment.${payment}`)}
            </p>
          )}

          {/* Like the "(modifier)" of the plan recap: the choice stays at hand on every step */}
          {showsPlan && (
            <p className="mt-6 text-sm text-slate-600">
              {t('create.plan.recap')}{' '}
              <span className="font-semibold text-slate-900">
                {flow.values.formula === 'pro'
                  ? `${t('create.plan.pro')}${proPlan ? ` (${planPrice(proPlan, true)})` : ''}`
                  : t('create.plan.free')}
              </span>{' '}
              <button type="button" onClick={flow.openPlan} className="font-semibold text-brand hover:underline">
                {t('create.plan.change')}
              </button>
            </p>
          )}

          {flow.step.id === 'name' && (
            <div className="mt-6">
              <AIWizardModal flow={flow} />
            </div>
          )}

          <p className="mt-7 text-sm font-semibold text-blue-800">
            {t('create.page.stepOf', { n: flow.index + 1, total: flow.steps.length })}
          </p>
          <h1 ref={titleRef} tabIndex={-1} className="mt-2 text-3xl leading-tight font-bold tracking-tight text-slate-900 outline-none sm:text-4xl">
            {heading.title}
          </h1>
          <p className="mt-3 text-[15px] text-slate-600">{heading.subtitle}</p>

          <div className="mt-8">
            {flow.formError && (
              <div className="mb-4">
                <FormAlert>{flow.formError}</FormAlert>
                {flow.proPending && (
                  <Button type="button" variant="outline" className="mt-3" onClick={flow.createFree} disabled={flow.isSubmitting}>
                    {t('create.payment.createFree')}
                  </Button>
                )}
              </div>
            )}
            {flow.step.id === 'name' && <NameStep flow={flow} />}
            {flow.step.id === 'topic' && <TopicStep flow={flow} categories={categories} isLoading={categoriesLoading} />}
            {flow.step.id === 'access' && <AccessStep flow={flow} />}
            {flow.step.id === 'look' && <LookStep flow={flow} />}
            {flow.step.id === 'account' && <AccountStep flow={flow} />}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            {flow.index > 0 ? (
              <button
                type="button"
                onClick={flow.back}
                disabled={flow.isSubmitting}
                className="inline-flex h-12 items-center gap-2 rounded-lg px-4 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                <ArrowLeft className="size-4" />
                {t('create.page.back')}
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={!canContinue || flow.isSubmitting}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-blue-900 px-5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-950 disabled:cursor-not-allowed disabled:bg-blue-900/45"
            >
              {flow.isSubmitting && <LoaderCircle className="size-4.5 animate-spin" />}
              {flow.paysNext ? (
                <>
                  {!flow.isSubmitting && <Lock className="size-4.5" />}
                  {flow.isSubmitting ? t('create.page.redirecting') : t('create.page.pay')}
                </>
              ) : flow.isLast ? (
                <>
                  <Sparkles className="size-4.5" />
                  {flow.isSubmitting
                    ? flow.isAnyUploading
                      ? t('create.page.uploading')
                      : t('create.page.creating')
                    : t('create.page.create')}
                </>
              ) : (
                <>
                  {t('create.page.continue')}
                  <ArrowRight className="size-4.5" />
                </>
              )}
            </button>
          </div>
        </form>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-8">
          <p className="text-[15px] font-semibold text-blue-800">{t('create.page.previewTitle')}</p>
          <CommunityPreview values={flow.values} slug={flow.slug} category={category} images={flow.previews} />

          <ol className="space-y-1 rounded-xl bg-white p-4 shadow-2xs" aria-label={t('create.page.stepsLabel')}>
            {flow.steps.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === flow.index ? 'step' : undefined}
                className={cn('flex items-center gap-3 py-1 text-[15px]', i === flow.index ? 'font-semibold text-slate-900' : 'text-slate-600')}
              >
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full border text-xs',
                    i < flow.index
                      ? 'border-blue-800 bg-blue-800 text-white'
                      : i === flow.index
                        ? 'border-blue-800 text-blue-800'
                        : 'border-slate-300 text-slate-500'
                  )}
                >
                  {i < flow.index ? <Check className="size-3.5" /> : i + 1}
                </span>
                {t(`create.steps.${s.id}`)}
              </li>
            ))}
          </ol>
        </aside>
      </main>

      <PlanChooser flow={flow} />
    </div>
  );
}

export default CreateCommunity;
