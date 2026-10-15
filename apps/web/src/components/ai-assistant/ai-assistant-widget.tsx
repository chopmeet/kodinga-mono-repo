import {
  ArrowRight,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Globe,
  HelpCircle,
  Lightbulb,
  Maximize2,
  MessageSquare,
  Minimize2,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, cn, customToast } from '@kodinga-mono-repo/ui';
import {
  useAssistantChatMutation,
  usePlanCommunityMutation,
  useRecommendCommunitiesMutation,
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

const starterPrompts = [
  {
    icon: Sparkles,
    label: 'Découvrir des communautés',
    prompt: 'Je recherche des communautés actives pour apprendre, collaborer et échanger.',
  },
  {
    icon: Lightbulb,
    label: 'Concevoir ma communauté',
    prompt: 'Je souhaite créer une communauté. Peux-tu me proposer une idée et un plan de lancement ?',
  },
  {
    icon: MessageSquare,
    label: 'Que publier en premier ?',
    prompt: 'Quelles sont les meilleures idées de premier post pour engager de nouveaux membres ?',
  },
  {
    icon: TrendingUp,
    label: 'Booster la participation',
    prompt: 'Quelles activités et événements hebdomadaires organisent les communautés qui réussissent ?',
  },
];

const languageOptions = [
  { code: 'fr', label: 'Français (FR)' },
  { code: 'en', label: 'English (EN)' },
  { code: 'wo', label: 'Wolof (WO)' },
  { code: 'bm', label: 'Bambara (BM)' },
];

export function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLang, setSelectedLang] = useState('fr');
  const [inputMessage, setInputMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Bonjour ! Je suis votre guide et bâtisseur de communauté Kodinga. Je peux vous aider à découvrir des groupes passionnants, concevoir votre propre espace ou dynamiser vos échanges. Comment puis-je vous aider aujourd’hui ?',
      suggestedFollowUps: [
        'Quelles communautés me conseilles-tu ?',
        'Je veux lancer une communauté tech en Afrique',
        'Comment accueillir mes premiers membres ?',
      ],
      provider: 'gemini',
      timestamp: new Date(),
    },
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [chatMutation, { isLoading: isChatLoading }] = useAssistantChatMutation();
  const [recommendMutation] = useRecommendCommunitiesMutation();
  const [planMutation] = usePlanCommunityMutation();

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
    customToast.success('Copié dans le presse-papier !');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || inputMessage;
    if (!textToSend.trim() || isChatLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');

    try {
      const lower = textToSend.toLowerCase();
      let specialRecommendations: CommunityRecommendationCard[] | undefined = undefined;
      let specialProposal: CommunityProposalResult | undefined = undefined;

      // Smart routing: check if user asks for recommendations directly
      if (
        lower.includes('recommande') ||
        lower.includes('cherche') ||
        lower.includes('trouve') ||
        lower.includes('découvrir') ||
        lower.includes('trouver')
      ) {
        try {
          const recRes = await recommendMutation({
            interests: textToSend,
            language: selectedLang,
          }).unwrap();
          if (recRes.data?.recommendations && recRes.data.recommendations.length > 0) {
            specialRecommendations = recRes.data.recommendations;
          }
        } catch {
          // If recommendation fails, let the general chat handle it
        }
      }

      // Smart routing: check if user asks to create / plan a community
      if (
        (lower.includes('créer') || lower.includes('lancer') || lower.includes('création') || lower.includes('plan')) &&
        (lower.includes('communauté') || lower.includes('groupe'))
      ) {
        try {
          const planRes = await planMutation({
            idea: textToSend,
            language: selectedLang,
          }).unwrap();
          if (planRes.data) {
            specialProposal = planRes.data;
          }
        } catch {
          // Fallback to chat
        }
      }

      const res = await chatMutation({
        message: textToSend,
        conversation_id: conversationId || undefined,
        language: selectedLang,
      }).unwrap();

      if (res.data) {
        if (res.data.conversation_id) {
          setConversationId(res.data.conversation_id);
        }

        const assistantMsg: Message = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: res.data.reply,
          recommendations: specialRecommendations,
          proposal: specialProposal,
          suggestedFollowUps: res.data.suggested_follow_ups || [],
          provider: res.data.provider || 'gemini',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          'L’Assistant Kodinga est momentanément indisponible ou a rencontré une erreur réseau. Veuillez réessayer dans quelques instants.',
        provider: 'fallback',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-slate-900 px-4 py-3 text-white shadow-xl shadow-brand/20 ring-2 ring-brand/40 transition-all duration-300 hover:scale-105 hover:bg-slate-800 hover:ring-brand focus:outline-none focus:ring-4 focus:ring-brand/30"
          title="Ouvrir l'Assistant IA Kodinga"
        >
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
          </span>
          <Sparkles className="size-5 text-brand" />
          <span className="text-sm font-semibold tracking-wide">Assistant Kodinga</span>
        </button>
      )}

      {/* Assistant Modal / Drawer */}
      {isOpen && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl transition-all duration-300',
            isExpanded
              ? 'h-[85vh] w-[95vw] sm:w-[650px]'
              : 'h-[620px] w-[92vw] sm:w-[460px]'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-brand/20 text-brand ring-1 ring-brand/30">
                <Bot className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight text-white">Assistant Kodinga</h3>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                    En ligne
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Guide & Bâtisseur (Gemini / OpenAI)</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language Selector */}
              <div className="relative flex items-center">
                <Globe className="mr-1 size-3.5 text-slate-400" />
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.code.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expand Toggle */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                title={isExpanded ? 'Réduire' : 'Agrandir'}
              >
                {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Fermer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm scrollbar-thin">
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
                      : 'border border-slate-200/80 bg-slate-50/90 text-slate-800'
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Grounded Community Recommendations Cards */}
                  {m.recommendations && m.recommendations.length > 0 && (
                    <div className="mt-3.5 space-y-2.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-brand">
                        Communautés recommandées :
                      </p>
                      <div className="grid gap-2">
                        {m.recommendations.map((rec) => (
                          <div
                            key={rec.id}
                            className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition hover:border-brand/50 hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-semibold text-slate-900">{rec.name}</h4>
                                <p className="text-xs text-slate-500 line-clamp-1">
                                  {rec.tagline || rec.description}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {rec.category}
                              </span>
                            </div>

                            <p className="mt-2 text-xs text-emerald-800 bg-emerald-50/80 rounded-md p-1.5 font-medium">
                              💡 {rec.relevance_reason}
                            </p>

                            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Users className="size-3.5" />
                                {rec.members_count} membres
                              </span>
                              <Link
                                to={`/community/${rec.slug}`}
                                onClick={() => setIsOpen(false)}
                                className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                              >
                                Découvrir
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
                          Proposition de communauté
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {m.proposal.recommended_visibility === 'public' ? 'Publique' : 'Privée'}
                        </span>
                      </div>

                      <div className="mt-1">
                        <p className="text-xs font-bold text-slate-700">Suggestions de noms :</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {m.proposal.name_suggestions.map((name, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 border border-slate-200"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-2">
                        <p className="text-xs font-bold text-slate-700">Mission :</p>
                        <p className="text-xs text-slate-600">{m.proposal.purpose || m.proposal.description}</p>
                      </div>

                      <div className="mt-2">
                        <p className="text-xs font-bold text-slate-700">Catégories suggérées :</p>
                        <p className="text-xs text-slate-600">
                          {m.proposal.suggested_categories.join(', ')}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Link
                          to="/create-community"
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand/90"
                        >
                          Lancer la création
                          <ArrowRight className="size-3.5" />
                        </Link>
                        <button
                          onClick={() =>
                            handleCopy(
                              JSON.stringify(m.proposal, null, 2),
                              `prop-${m.id}`
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {copiedId === `prop-${m.id}` ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          Copier le plan
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Provider Info */}
                  {m.provider && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                      <span>Généré par {m.provider === 'gemini' ? 'Google Gemini' : 'OpenAI Fallback'}</span>
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
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand hover:bg-slate-50 hover:text-brand"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isChatLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <span className="flex size-2 animate-ping rounded-full bg-brand" />
                <span>L’Assistant Kodinga réfléchit...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starters (shown if only initial message) */}
          {messages.length === 1 && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Actions rapides :
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {starterPrompts.map((s, idx) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(s.prompt)}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left text-xs text-slate-700 transition hover:border-brand hover:text-brand"
                    >
                      <Icon className="size-3.5 shrink-0 text-brand" />
                      <span className="line-clamp-1">{s.label}</span>
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
            className="border-t border-slate-100 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Posez une question, demandez un conseil..."
                disabled={isChatLoading}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isChatLoading}
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
