import { Bot, Check, Globe, Loader2, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';

import { Button, cn, customToast, Dialog, DialogContent, DialogDescription, DialogTitle } from '@kodinga/ui';
import { usePlanCommunityMutation } from '@/utils/api/community/community.api';
import type { CommunityProposalResult } from '@/utils/api/community/community.type';
import type { CreateCommunityFlow } from '../form/UseCreateCommunity';

interface AIWizardModalProps {
  flow: CreateCommunityFlow;
}

export function AIWizardModal({ flow }: AIWizardModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [idea, setIdea] = useState('');
  const { t, i18n } = useTranslation();
  // The proposal comes in the language of the interface by default (Wolof and Bambara on request)
  const [selectedLanguage, setSelectedLanguage] = useState<string>(i18n.resolvedLanguage === 'en' ? 'en' : 'fr');
  const [selectedName, setSelectedName] = useState<string>('');
  const [proposal, setProposal] = useState<CommunityProposalResult | null>(null);

  const [planMutation, { isLoading }] = usePlanCommunityMutation();
  // The proposal lands under the idea field: brought into view (below the fold on a phone)
  const proposalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (proposal) proposalRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [proposal]);

  const handleGenerate = async () => {
    if (!idea.trim() || isLoading) return;

    try {
      const res = await planMutation({
        idea,
        language: selectedLanguage,
      }).unwrap();

      if (res.data) {
        setProposal(res.data);
        if (res.data.name_suggestions && res.data.name_suggestions.length > 0) {
          setSelectedName(res.data.name_suggestions[0]);
        }
      }
    } catch {
      customToast.error({ message: t('create.ai.failed') });
    }
  };

  const handleApplyToForm = () => {
    if (!proposal) return;

    const chosenName = selectedName || (proposal.name_suggestions[0] ?? '');
    if (chosenName) {
      flow.form.setValue('name', chosenName, { shouldValidate: true });
    }

    if (proposal.purpose) {
      flow.form.setValue('tagline', proposal.purpose.slice(0, 200), {
        shouldValidate: true,
      });
    }

    if (proposal.recommended_visibility === 'private') {
      flow.form.setValue('privacy_type', 'private');
    } else {
      flow.form.setValue('privacy_type', 'public');
    }

    customToast.success({ message: t('create.ai.applied') });
    setIsOpen(false);
  };

  return (
    <>
      {/* Banner placed at the top of the creation flow */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/10 via-brand/5 to-subtle p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-brand ring-1 ring-brand/30">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {t('create.ai.bannerTitle')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('create.ai.bannerText')}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setIsOpen(true)}
            className="w-full shrink-0 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-bold text-white shadow-xs hover:bg-slate-800 sm:w-auto sm:text-xs"
          >
            <Sparkles className="mr-1.5 size-3.5 text-brand" />
            {t('create.ai.design')}
          </Button>
        </div>
      </div>

      {/* Phones: nearly the whole screen, the header and the footer stay, only the content scrolls */}
      <Dialog open={isOpen} onOpenChange={(open) => !isLoading && setIsOpen(open)}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-3rem)] max-w-full flex-col gap-0 overflow-hidden border-border p-0 sm:max-h-[calc(100dvh-5rem)] sm:max-w-2xl sm:rounded-2xl"
        >
          {/* Modal Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 bg-slate-900 px-4 py-3.5 text-white sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/20 text-brand">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm leading-snug font-bold text-white">{t('create.ai.title')}</DialogTitle>
                <DialogDescription className="sr-only text-[11px] text-faint sm:not-sr-only">{t('create.ai.poweredBy')}</DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t('common.actions.close')}
              className="shrink-0 rounded-lg p-1.5 text-faint hover:bg-slate-800 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm sm:p-6">
            <div>
              <label htmlFor="ai-wizard-idea" className="block text-xs font-bold tracking-wider text-soft uppercase">
                {t('create.ai.describe')}
              </label>
              {/* 16 px on phones: iOS zooms into smaller fields */}
              <textarea
                id="ai-wizard-idea"
                rows={4}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder={t('create.ai.placeholder')}
                className="mt-2 w-full resize-y rounded-xl border border-border p-3 text-base leading-relaxed text-foreground placeholder-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none sm:text-sm"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2">
                <Globe className="size-4 shrink-0 text-faint" aria-hidden />
                <span className="text-xs text-soft">{t('create.ai.language')}</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="rounded-lg border border-border bg-subtle px-2 py-1.5 text-sm font-semibold text-body"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="wo">Wolof</option>
                  <option value="bm">Bambara</option>
                </select>
              </label>

              <Button
                type="button"
                disabled={!idea.trim() || isLoading}
                onClick={handleGenerate}
                className="w-full rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand/90 disabled:opacity-50 sm:w-auto sm:text-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    {t('create.ai.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 size-3.5" />
                    {t('create.ai.generate')}
                  </>
                )}
              </Button>
            </div>

            {/* Generated Proposal View */}
            {proposal && (
              <div ref={proposalRef} className="scroll-mt-4 space-y-4 rounded-xl border border-border bg-subtle/70 p-3.5 sm:p-4">
                <div>
                  <span className="text-xs font-bold tracking-wider text-brand uppercase">{t('create.ai.names')}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {proposal.name_suggestions.map((name, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={selectedName === name}
                        onClick={() => setSelectedName(name)}
                        className={cn(
                          'max-w-full rounded-lg px-3 py-1.5 text-left text-sm font-semibold break-words transition sm:text-xs',
                          selectedName === name
                            ? 'border-2 border-brand bg-card text-brand shadow-xs'
                            : 'border border-border bg-card text-body hover:border-border-strong'
                        )}
                      >
                        {name}
                        {selectedName === name && <Check className="ml-1.5 inline size-3.5 text-brand" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold tracking-wider text-body uppercase">{t('create.ai.mission')}</span>
                  <p className="mt-1 rounded-lg border border-border bg-card p-2.5 text-sm text-body sm:text-xs">
                    {proposal.purpose || proposal.description}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-bold tracking-wider text-body uppercase">{t('create.ai.categories')}</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {proposal.suggested_categories.map((cat, i) => (
                      <span key={i} className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-soft">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold tracking-wider text-body uppercase">{t('create.ai.firstDiscussion')}</span>
                  <p className="mt-1 text-sm text-soft italic sm:text-xs">
                    "{proposal.first_discussion_prompts[0] || t('create.ai.defaultPrompt')}"
                  </p>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground sm:text-[11px]">
                    <span role="img" aria-label={t('create.ai.warning')}>
                      ⚠️
                    </span>{' '}
                    <strong>{t('create.ai.confirmTitle')}</strong> {t('create.ai.confirmText')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer: full-width buttons on phones, the main one on top */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border-soft bg-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6 sm:py-3.5">
            <Button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-body hover:bg-muted sm:w-auto sm:text-xs"
            >
              {t('common.actions.cancel')}
            </Button>
            {proposal && (
              <Button
                type="button"
                onClick={handleApplyToForm}
                className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 sm:w-auto sm:text-xs"
              >
                <Check className="mr-1.5 size-3.5 text-brand" />
                {t('create.ai.apply')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
