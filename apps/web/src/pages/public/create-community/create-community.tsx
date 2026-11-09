import { ArrowLeft, ArrowRight, Check, LoaderCircle, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@kodinga/ui';
import { Logo } from '@/layouts/components/header';
import { FormAlert } from '@/pages/auth/components/form-alert';
import { useGetCommunityCategoriesQuery } from '@/utils/api/community/community.api';
import { CommunityPreview } from './components/community-preview';
import { AccessStep, AccountStep, LookStep, NameStep, TopicStep } from './components/steps';
import { AIWizardModal } from './components/ai-wizard-modal';
import UseCreateCommunity from './form/UseCreateCommunity';


/** /create-community — Skool-like creation flow, open to visitors (account asked at the end) */
function CreateCommunity() {
  const { t } = useTranslation();
  const flow = UseCreateCommunity();
  const { data: categories = [], isLoading: categoriesLoading } = useGetCommunityCategoriesQuery();
  const heading = {
    title: t(`create.headings.${flow.step.id}Title`),
    subtitle: t(`create.headings.${flow.step.id}Subtitle`),
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

  // Step 1 waits for a usable name, like in the design (the button lights up once it is typed)
  const canContinue = flow.step.id !== 'name' || flow.values.name.trim().length >= 3;

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
              {flow.isLast ? (
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
    </div>
  );
}

export default CreateCommunity;
