import { Bot, Check, Globe, Loader2, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { Button, cn, customToast } from '@kodinga/ui';
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
      <div className="mb-8 overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/10 via-brand/5 to-slate-50 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-brand ring-1 ring-brand/30">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {t('create.ai.bannerTitle')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('create.ai.bannerText')}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setIsOpen(true)}
            className="shrink-0 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800"
          >
            <Sparkles className="mr-1.5 size-3.5 text-brand" />
            {t('create.ai.design')}
          </Button>
        </div>
      </div>

      {/* Interactive Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-brand/20 text-brand">
                  <Bot className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{t('create.ai.title')}</h3>
                  <p className="text-[11px] text-slate-400">
                    {t('create.ai.poweredBy')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t('common.actions.close')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 space-y-5 overflow-y-auto p-6 text-sm">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  {t('create.ai.describe')}
                </label>
                <textarea
                  rows={3}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder={t('create.ai.placeholder')}
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed text-slate-800 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-slate-400" />
                  <span className="text-xs text-slate-600">{t('create.ai.language')}</span>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="wo">Wolof</option>
                    <option value="bm">Bambara</option>
                  </select>
                </div>

                <Button
                  type="button"
                  disabled={!idea.trim() || isLoading}
                  onClick={handleGenerate}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand/90 disabled:opacity-50"
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
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-brand">
                      {t('create.ai.names')}
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {proposal.name_suggestions.map((name, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedName(name)}
                          className={cn(
                            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                            selectedName === name
                              ? 'border-2 border-brand bg-white text-brand shadow-xs'
                              : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          )}
                        >
                          {name}
                          {selectedName === name && (
                            <Check className="ml-1.5 inline size-3.5 text-brand" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {t('create.ai.mission')}
                    </span>
                    <p className="mt-1 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                      {proposal.purpose || proposal.description}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {t('create.ai.categories')}
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {proposal.suggested_categories.map((cat, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {t('create.ai.firstDiscussion')}
                    </span>
                    <p className="mt-1 text-xs italic text-slate-600">
                      "{proposal.first_discussion_prompts[0] || t('create.ai.defaultPrompt')}"
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-[11px] text-slate-500">
                      <span role="img" aria-label={t('create.ai.warning')}>
                        ⚠️
                      </span>{' '}
                      <strong>{t('create.ai.confirmTitle')}</strong> {t('create.ai.confirmText')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3.5">
              <Button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {t('common.actions.cancel')}
              </Button>
              {proposal && (
                <Button
                  type="button"
                  onClick={handleApplyToForm}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
                >
                  <Check className="mr-1.5 size-3.5 text-brand" />
                  {t('create.ai.apply')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
