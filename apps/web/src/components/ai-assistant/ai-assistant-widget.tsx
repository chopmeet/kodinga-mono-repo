import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  Globe,
  Lightbulb,
  Maximize2,
  MessageSquare,
  Minimize2,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { cn, customToast } from '@kodinga/ui';
import {
  useAssistantChatMutation,
} from '@/utils/api/community/community.api';
import type {
  CommunityProposalResult,
  CommunityRecommendationCard,
} from '@/utils/api/community/community.type';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recommendations?: CommunityRecommendationCard[];
  proposal?: CommunityProposalResult;
  suggestedFollowUps?: string[];
  provider?: string;
  timestamp: Date;
}

// Labels and prompts are translated keys (assistant.starters.*)
const starterPrompts = [
  { icon: Sparkles, id: 'discover' },
  { icon: Lightbulb, id: 'design' },
  { icon: MessageSquare, id: 'firstPost' },
  { icon: TrendingUp, id: 'boost' },
] as const;

const languageOptions = [
  { code: 'fr', label: 'Français (FR)' },
  { code: 'en', label: 'English (EN)' },
  { code: 'wo', label: 'Wolof (WO)' },
  { code: 'bm', label: 'Bambara (BM)' },
];

export function AIAssistantWidget() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // Replies in the language of the interface by default (Wolof and Bambara on request)
  const [selectedLang, setSelectedLang] = useState<string>(i18n.resolvedLanguage === 'en' ? 'en' : 'fr');
  const [inputMessage, setInputMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('assistant.welcome'),
      suggestedFollowUps: [t('assistant.followUps.advise'), t('assistant.followUps.launch'), t('assistant.followUps.welcome')],
      provider: 'openai',
      timestamp: new Date(),
    },
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [chatMutation, { isLoading: isChatLoading }] = useAssistantChatMutation();
  const isBusy = isChatLoading || isSending;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    customToast.success({ message: t('assistant.copied') });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || inputMessage).trim();
    if (!textToSend || isBusy) return;

    const userMsgId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);

    try {
      const res = await chatMutation({
        message: textToSend,
        conversation_id: conversationId || undefined,
        language: selectedLang,
      }).unwrap();

      if (res.data) {
        if (res.data.conversation_id) {
          setConversationId(res.data.conversation_id);
        }

        const payloadData = (res.data.data || {}) as {
          recommendations?: CommunityRecommendationCard[];
          proposal?: CommunityProposalResult;
        };

        const assistantMsg: Message = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: res.data.reply,
          recommendations: payloadData.recommendations,
          proposal: payloadData.proposal,
          suggestedFollowUps: res.data.suggested_follow_ups || [],
          provider: res.data.provider || 'openai',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: t('assistant.error'),
        provider: 'fallback',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t('assistant.name')}
          // Phones: a round button (icon only) that hides less of the page
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-full bg-slate-900 p-3.5 text-white sm:bottom-6 sm:right-6 sm:px-4 sm:py-3 shadow-xl shadow-brand/20 ring-2 ring-brand/40 transition-all duration-300 hover:scale-105 hover:bg-slate-800 hover:ring-brand focus:outline-none focus:ring-4 focus:ring-brand/30"
          title={t('assistant.open')}
        >
          <span className="relative hidden size-3 sm:flex">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
          </span>
          <Sparkles className="size-5 text-brand" />
          <span className="hidden text-sm font-semibold tracking-wide sm:inline">{t('assistant.name')}</span>
        </button>
      )}

      {/* Assistant Modal / Drawer */}
      {isOpen && (
        <div
          className={cn(
            // Phones: the width of the screen less a margin on each side; larger: a panel at the bottom right
            'fixed inset-x-3 bottom-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300 sm:inset-x-auto sm:right-4 sm:bottom-4',
            // Never taller than the screen (minus the margins): the header (close, expand, language) stays visible
            isExpanded
              ? 'h-[min(85dvh,calc(100dvh-1.5rem))] sm:w-[650px]'
              : 'h-[min(620px,calc(100dvh-1.5rem))] sm:w-[460px]'
          )}
        >
          {/* Header */}
          {/* One line on a phone: the title and the subtitle are cut rather than wrapped, the actions keep their room */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-soft bg-slate-900 px-3 py-3 text-white sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand ring-1 ring-brand/30 max-[339px]:hidden sm:size-9">
                <Bot className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-bold tracking-tight text-white">{t('assistant.name')}</h3>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
                    <span className="max-[399px]:sr-only">{t('assistant.online')}</span>
                  </span>
                </div>
                <p className="truncate text-[11px] text-faint">{t('assistant.subtitle')}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {/* Language Selector */}
              <div className="relative flex items-center">
                <Globe className="mr-1 hidden size-3.5 text-faint sm:block" aria-hidden />
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  aria-label={t('assistant.replyLanguage')}
                  className="rounded-md border border-slate-700 bg-slate-800 px-1.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand sm:px-2"
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.code.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expand Toggle: a phone already gives the whole width */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? t('assistant.reduce') : t('assistant.expand')}
                className="hidden rounded-lg p-1.5 text-faint hover:bg-slate-800 hover:text-white sm:inline-flex"
                title={isExpanded ? t('assistant.reduce') : t('assistant.expand')}
              >
                {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t('assistant.close')}
                className="rounded-lg p-1.5 text-faint hover:bg-slate-800 hover:text-white"
                title={t('assistant.closeShort')}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm scrollbar-thin">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed shadow-sm',
                    m.role === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'border border-border/80 bg-subtle/90 text-foreground'
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Grounded Community Recommendations Cards */}
                  {m.recommendations && m.recommendations.length > 0 && (
                    <div className="mt-3.5 space-y-2.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-brand">
                        {t('assistant.recommended')}
                      </p>
                      <div className="grid gap-2">
                        {m.recommendations.map((rec) => (
                          <div
                            key={rec.id}
                            className="rounded-xl border border-border bg-card p-3 shadow-xs transition hover:border-brand/50 hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-semibold text-foreground">{rec.name}</h4>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {rec.tagline || rec.description}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-soft">
                                {rec.category}
                              </span>
                            </div>

                            <p className="mt-2 text-xs text-emerald-800 bg-emerald-50/80 rounded-md p-1.5 font-medium">
                              <span role="img" aria-label={t('assistant.why')}>💡</span> {rec.relevance_reason}
                            </p>

                            <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="size-3.5" />
                                {t('assistant.members', { count: rec.members_count })}
                              </span>
                              <Link
                                to={`/communities/${rec.slug}`}
                                onClick={() => setIsOpen(false)}
                                className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                              >
                                {t('assistant.discover')}
                                <ArrowRight className="size-3" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Community Creation Proposal Card */}
                  {m.proposal && (
                    <div className="mt-3.5 space-y-2 rounded-xl border border-brand/20 bg-brand/5 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-brand">
                          {t('assistant.proposal')}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {m.proposal.recommended_visibility === 'public' ? t('assistant.public') : t('assistant.private')}
                        </span>
                      </div>

                      <div className="mt-1">
                        <p className="text-xs font-bold text-body">{t('assistant.nameIdeas')}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {m.proposal.name_suggestions.map((name, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-card px-2 py-0.5 text-xs font-semibold text-foreground border border-border"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-2">
                        <p className="text-xs font-bold text-body">{t('assistant.mission')}</p>
                        <p className="text-xs text-soft">{m.proposal.purpose || m.proposal.description}</p>
                      </div>

                      <div className="mt-2">
                        <p className="text-xs font-bold text-body">{t('assistant.categories')}</p>
                        <p className="text-xs text-soft">
                          {m.proposal.suggested_categories.join(', ')}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Link
                          to="/create-community"
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand/90"
                        >
                          {t('assistant.startCreation')}
                          <ArrowRight className="size-3.5" />
                        </Link>
                        <button
                          onClick={() =>
                            handleCopy(
                              JSON.stringify(m.proposal, null, 2),
                              `prop-${m.id}`
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-body hover:bg-subtle"
                        >
                          {copiedId === `prop-${m.id}` ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          {t('assistant.copyPlan')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Provider Info */}
                  {m.provider && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-faint">
                      <span>{m.provider === 'fallback' ? t('assistant.automatic') : t('assistant.generated')}</span>
                    </div>
                  )}
                </div>

                {/* Follow-up Prompts */}
                {m.suggestedFollowUps && m.suggestedFollowUps.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.suggestedFollowUps.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(prompt)}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-soft transition hover:border-brand hover:bg-subtle hover:text-brand"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isBusy && (
              <div className="flex items-start">
                <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-subtle/90 px-4 py-3 text-xs text-soft shadow-xs">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-brand" />
                  </span>
                  <span className="font-medium">{t('assistant.thinking')}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starters (shown if only initial message) */}
          {messages.length === 1 && (
            <div className="max-h-[30dvh] shrink-0 overflow-y-auto border-t border-border-soft bg-subtle/50 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">
                {t('assistant.quickActions')}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {starterPrompts.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSend(t(`assistant.starters.${s.id}Prompt`))}
                      className="flex items-start gap-2 rounded-lg border border-border bg-card p-2 text-left text-xs text-body transition hover:border-brand hover:text-brand"
                    >
                      <Icon className="mt-0.5 size-3.5 shrink-0 text-brand" />
                      {/* Two lines: one cut the labels on a phone */}
                      <span className="line-clamp-2">{t(`assistant.starters.${s.id}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="shrink-0 border-t border-border-soft bg-card p-3"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={t('assistant.placeholder')}
                aria-label={t('assistant.placeholder')}
                disabled={isBusy}
                className="flex-1 rounded-xl border border-border bg-subtle px-3.5 py-2.5 text-xs text-foreground placeholder-slate-400 focus:border-brand focus:bg-card focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isBusy}
                aria-label={t('assistant.send')}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm transition hover:bg-brand/90 disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
