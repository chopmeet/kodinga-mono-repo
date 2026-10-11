import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@kodinga-mono-repo/ui';
import { FormAlert } from '@/pages/auth/components/form-alert';
import { SubmitButton } from '@/pages/auth/components/submit-button';
import { useGetCommunityCategoriesQuery } from '@/utils/api/community/community.api';
import { CommunityPreview } from './components/community-preview';
import { AccessStep, AccountStep, LookStep, NameStep, TopicStep } from './components/steps';
import UseCreateCommunity, { type StepId } from './form/UseCreateCommunity';

const headings: Record<StepId, { title: string; subtitle: string }> = {
  name: { title: 'Comment s’appelle votre communauté ?', subtitle: 'Choisissez un nom clair : vous pourrez le changer plus tard.' },
  topic: { title: 'De quoi va-t-on parler ?', subtitle: 'Aidez les développeurs à trouver votre communauté dans l’annuaire.' },
  access: { title: 'Qui peut la rejoindre ?', subtitle: 'Vous pourrez modifier ces réglages à tout moment.' },
  look: { title: 'Donnez-lui une identité', subtitle: 'Une couleur suffit pour se démarquer.' },
  account: { title: 'Dernière étape : votre compte', subtitle: 'Créez votre compte Kodinga pour gérer votre communauté.' },
};

/** /create-community — Skool-like creation flow, open to visitors (account asked at the end) */
function CreateCommunity() {
  const flow = UseCreateCommunity();
  const { data: categories = [], isLoading: categoriesLoading } = useGetCommunityCategoriesQuery();
  const heading = headings[flow.step.id];
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

  const progress = ((flow.index + 1) / flow.steps.length) * 100;

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2" title="Kodinga">
            <span className="flex size-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-brand">K</span>
            <span className="hidden text-xl font-bold tracking-tight text-slate-900 sm:inline">
              kodinga<span className="text-brand">.</span>
            </span>
          </Link>
          <ol className="hidden items-center gap-2 text-sm md:flex" aria-label="Étapes">
            {flow.steps.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2">
                <span
                  aria-current={i === flow.index ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 font-medium',
                    i === flow.index ? 'text-slate-900' : i < flow.index ? 'text-brand' : 'text-slate-400'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-[11px] font-bold',
                      i <= flow.index ? 'bg-brand text-white' : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {i + 1}
                  </span>
                  {s.label}
                </span>
                {i < flow.steps.length - 1 && <span className="h-px w-5 bg-slate-200" aria-hidden />}
              </li>
            ))}
          </ol>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <X className="size-4" />
            Quitter
          </Link>
        </div>
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-14">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            flow.next();
          }}
          className="max-w-xl"
        >
          <p className="text-sm font-semibold text-brand">
            Étape {flow.index + 1} sur {flow.steps.length}
          </p>
          <h1 ref={titleRef} tabIndex={-1} className="mt-2 text-3xl font-bold tracking-tight text-slate-900 outline-none sm:text-4xl">
            {heading.title}
          </h1>
          <p className="mt-3 text-[15px] text-slate-500">{heading.subtitle}</p>

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

          <div className="mt-8 flex items-center gap-3">
            {flow.index > 0 && (
              <button
                type="button"
                onClick={flow.back}
                disabled={flow.isSubmitting}
                className="inline-flex h-13 items-center gap-2 rounded-xl px-4 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                <ArrowLeft className="size-4" />
                Retour
              </button>
            )}
            <div className="flex-1">
              <SubmitButton isLoading={flow.isSubmitting}>
                {flow.isLast ? (
                  <>
                    <Sparkles className="size-5" />
                    Créer ma communauté
                  </>
                ) : (
                  <>
                    Continuer
                    <ArrowRight className="size-5" />
                  </>
                )}
              </SubmitButton>
            </div>
          </div>
        </form>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">Aperçu en direct</p>
          <CommunityPreview values={flow.values} slug={flow.slug} category={category} />
        </aside>
      </main>
    </div>
  );
}

export default CreateCommunity;
