import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileText,
  Lightbulb,
  ListTodo,
  Loader2,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserRound,
  Video,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Badge, Button, Input } from '@kodinga-mono-repo/ui';
import { ReplayPlayer } from '@/pages/shared/replay-player';
import {
  useChatEventTranscriptMutation,
  useGenerateEventSummaryMutation,
  useGetEventTranscriptionQuery,
  useTranscribeEventLiveMutation,
} from '@/utils/api/community/community.api';
import type { CommunityEvent, LiveTranscriptionSegment } from '@/utils/api/event/event.type';

interface EventAIReplayHubProps {
  slug: string;
  event: CommunityEvent;
  canManage?: boolean;
  className?: string;
}

type ActiveTab = 'video' | 'transcript' | 'summary' | 'chat';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  referenced_segments?: string[];
  suggested_follow_ups?: string[];
  time?: string;
}

export function EventAIReplayHub({ slug, event, canManage = false, className = '' }: EventAIReplayHubProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('video');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Poll every 3 seconds only while processing
  const [pollingInterval, setPollingInterval] = useState(0);

  const {
    data: transcriptionData,
    isLoading: isLoadingTranscription,
    refetch: refetchTranscription,
  } = useGetEventTranscriptionQuery(
    { slug, eventId: event.id },
    {
      skip: !event.id,
      pollingInterval,
    }
  );

  const [transcribeEvent, { isLoading: isTriggeringTranscribe }] = useTranscribeEventLiveMutation();
  const [generateSummary, { isLoading: isGeneratingSummary }] = useGenerateEventSummaryMutation();
  const [chatTranscript, { isLoading: isSendingChat }] = useChatEventTranscriptMutation();

  const isProcessing = transcriptionData?.status === 'processing';
  const hasTranscription = Boolean(transcriptionData?.has_transcription && transcriptionData.transcription);
  const summary = transcriptionData?.summary;

  // Control polling: poll when status is processing
  useEffect(() => {
    if (isProcessing) {
      setPollingInterval(3000);
    } else {
      setPollingInterval(0);
    }
  }, [isProcessing]);

  // Initial welcome message in Chat with Docs
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Bonjour ! Je suis votre assistant pour le live **« ${event.title} »**. Posez-moi n'importe quelle question sur ce qui s'est dit durant cette session, et je vous répondrai fidèlement en citant les passages clés.`,
          suggested_follow_ups: [
            'Quels étaient les points majeurs abordés ?',
            'Quelles sont les prochaines étapes recommandées ?',
            'Y a-t-il eu des questions des participants ?',
          ],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [event.title, messages.length]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (activeTab === 'chat' && typeof chatScrollRef.current?.scrollIntoView === 'function') {
      chatScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleStartTranscribe = async (force = false) => {
    try {
      await transcribeEvent({ slug, eventId: event.id, force, language: 'fr' }).unwrap();
      refetchTranscription();
    } catch {
      // Handled by mutation error state
    }
  };

  const handleRefreshSummary = async () => {
    try {
      await generateSummary({ slug, eventId: event.id }).unwrap();
      refetchTranscription();
    } catch {
      // Handled by mutation error state
    }
  };

  const handleCopyTranscript = () => {
    if (!transcriptionData?.transcription) return;
    navigator.clipboard.writeText(transcriptionData.transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    if (!transcriptionData?.transcription) return;
    const blob = new Blob([transcriptionData.transcription], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcription-${event.slug || event.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || isSendingChat) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');

    try {
      const historyPayload = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await chatTranscript({
        slug,
        eventId: event.id,
        message: text,
        history: historyPayload,
      }).unwrap();

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.reply,
        referenced_segments: response.referenced_segments,
        suggested_follow_ups: response.suggested_follow_ups,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: "Désolé, une erreur est survenue lors de l'analyse du live. Veuillez réessayer dans un instant.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  // Filter segments by search query
  const filteredSegments = useMemo(() => {
    const segments = transcriptionData?.segments || [];
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter(
      (s: LiveTranscriptionSegment) => s.text.toLowerCase().includes(q) || s.speaker.toLowerCase().includes(q)
    );
  }, [transcriptionData?.segments, searchQuery]);

  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden ${className}`}>
      {/* Top Header & Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-3 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Espace Replay & Assistant IA</h3>
            <p className="text-xs text-slate-500">Vidéo, transcription automatique, résumé exécutif et chat interactif</p>
          </div>
        </div>

        {/* Tab switch buttons */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-200/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'video' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className="size-3.5 text-indigo-500" />
            <span>Vidéo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'transcript' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="size-3.5 text-emerald-600" />
            <span>Transcription</span>
            {hasTranscription && <span className="size-1.5 rounded-full bg-emerald-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'summary' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lightbulb className="size-3.5 text-amber-500" />
            <span>Résumé IA</span>
            {summary && <span className="size-1.5 rounded-full bg-amber-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'chat' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="size-3.5 text-sky-500" />
            <span>Chat with Docs</span>
            <Badge variant="outline" className="h-4 border-sky-400 bg-sky-50 px-1 text-[10px] text-sky-700">
              IA
            </Badge>
          </button>
        </div>
      </div>

      {/* Asynchronous Processing Banner */}
      {isProcessing && (
        <div className="flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 px-4 py-2.5 text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-indigo-600" />
            <span className="font-medium">
              Transcription asynchrone en cours de traitement en arrière-plan par l'IA…
            </span>
          </div>
          <span className="text-[11px] text-indigo-700">Actualisation automatique dans quelques secondes</span>
        </div>
      )}

      {/* TAB 1: VIDEO REPLAY */}
      {activeTab === 'video' && (
        <div className="p-4 sm:p-5">
          {event.replay_video_asset ? (
            <div className="space-y-4">
              <ReplayPlayer video={event.replay_video_asset} title={event.title} className="w-full max-w-4xl mx-auto rounded-xl shadow-md" />
              {/* Quick AI action bar under video */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <PlayCircle className="size-4 text-emerald-600" />
                  <span>Enregistrement officiel du meet · {event.duration_minutes} min</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!hasTranscription && !isProcessing && (
                    <Button
                      size="sm"
                      onClick={() => handleStartTranscribe(false)}
                      disabled={isTriggeringTranscribe}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      {isTriggeringTranscribe ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      Transcrire le direct
                    </Button>
                  )}
                  {hasTranscription && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab('transcript')} className="gap-1.5 text-xs">
                        <FileText className="size-3.5 text-emerald-600" /> Voir la transcription
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab('summary')} className="gap-1.5 text-xs">
                        <Lightbulb className="size-3.5 text-amber-500" /> Résumé exécutif
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('chat')}
                        className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white gap-1.5 text-xs hover:opacity-90"
                      >
                        <MessageSquare className="size-3.5" /> Chatter avec ce meet
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Video className="size-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">Aucun replay vidéo n'est encore associé à cet événement.</p>
              <p className="text-xs text-slate-400 mt-1">L'enregistrement sera disponible dès qu'il aura été téléversé par l'hôte.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRANSCRIPTION */}
      {activeTab === 'transcript' && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Transcript Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="relative w-64 sm:w-80">
                <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher dans la transcription…"
                  className="pl-8 text-xs"
                />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Effacer
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!hasTranscription && !isProcessing && (
                <Button
                  size="sm"
                  onClick={() => handleStartTranscribe(false)}
                  disabled={isTriggeringTranscribe}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                >
                  {isTriggeringTranscribe ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Transcrire le live
                </Button>
              )}
              {hasTranscription && canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartTranscribe(true)}
                  disabled={isTriggeringTranscribe || isProcessing}
                  title="Régénérer la transcription"
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={`size-3.5 ${isTriggeringTranscribe ? 'animate-spin' : ''}`} />
                  Régénérer
                </Button>
              )}
              {hasTranscription && (
                <>
                  <Button size="sm" variant="outline" onClick={handleCopyTranscript} className="gap-1 text-xs">
                    {copied ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownloadTranscript} className="gap-1 text-xs">
                    <Download className="size-3.5" /> Télécharger .txt
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Transcript Content List */}
          {isLoadingTranscription && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <Loader2 className="size-8 animate-spin text-emerald-600 mb-2" />
              <p className="text-sm">Chargement de la transcription…</p>
            </div>
          )}

          {!isLoadingTranscription && !hasTranscription && !isProcessing && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
              <FileText className="size-10 text-slate-300 mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">Transcription non encore générée</h4>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                La transcription automatique permet d'extraire l'intégralité des propos avec horodatages, d'activer le résumé
                exécutif et d'interroger le direct avec le Chat IA.
              </p>
              <Button
                onClick={() => handleStartTranscribe(false)}
                disabled={isTriggeringTranscribe}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {isTriggeringTranscribe ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Lancer la transcription automatique (Asynchrone)
              </Button>
            </div>
          )}

          {!isLoadingTranscription && hasTranscription && (
            <div className="max-h-[460px] overflow-y-auto pr-2 space-y-3 divide-y divide-slate-100">
              {filteredSegments.length > 0 ? (
                filteredSegments.map((seg, idx) => (
                  <div key={idx} className="pt-3 first:pt-0 group hover:bg-slate-50/80 p-2.5 rounded-lg transition-colors">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <div className="flex items-center gap-2">
                        <UserRound className="size-3 text-slate-400" />
                        <span className="font-medium text-slate-700">{seg.speaker}</span>
                      </div>
                      <span className="font-mono text-[11px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-800 transition-colors">
                        {seg.start} - {seg.end}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{seg.text}</p>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">Aucun passage ne correspond à votre recherche « {searchQuery} ».</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXECUTIVE SUMMARY */}
      {activeTab === 'summary' && (
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Lightbulb className="size-4 text-amber-500" />
                Résumé Exécutif du Live
              </h4>
              <p className="text-xs text-slate-500">Synthèse automatique générée par l'intelligence artificielle Kodinga</p>
            </div>
            {summary && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshSummary}
                disabled={isGeneratingSummary}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`size-3.5 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
                Régénérer le résumé
              </Button>
            )}
          </div>

          {!summary && !isGeneratingSummary && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
              <Lightbulb className="size-10 text-amber-300 mb-3" />
              <h4 className="text-sm font-semibold text-slate-800">Résumé non disponible</h4>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Générez le résumé exécutif pour obtenir les points clés, décisions et actions à mener sans devoir revoir toute la vidéo.
              </p>
              <Button
                onClick={handleRefreshSummary}
                disabled={isGeneratingSummary}
                className="mt-4 bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              >
                {isGeneratingSummary ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Générer le résumé IA
              </Button>
            </div>
          )}

          {isGeneratingSummary && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <Loader2 className="size-8 animate-spin text-amber-600 mb-2" />
              <p className="text-sm">Génération du résumé IA en cours…</p>
            </div>
          )}

          {summary && !isGeneratingSummary && (
            <div className="space-y-5">
              {/* Overview Card */}
              <div className="rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-orange-50/30 p-4 sm:p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">📌 Synthèse Globale</span>
                <p className="mt-2 text-sm leading-relaxed text-slate-800 font-medium">{summary.overview}</p>
              </div>

              {/* Grid: Key Points & Action items */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Key Points */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center gap-2 mb-3 text-slate-900 font-semibold text-sm">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>Points Clés Abordés</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {summary.key_points?.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Items */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center gap-2 mb-3 text-slate-900 font-semibold text-sm">
                    <ListTodo className="size-4 text-sky-600" />
                    <span>Actions & Prochaines Étapes</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {summary.action_items?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-sky-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Decisions Card */}
              {summary.decisions && summary.decisions.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2 mb-2 text-slate-900 font-semibold text-xs uppercase tracking-wider">
                    <span>⚖️ Décisions & Recommandations de l'équipe</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {summary.decisions.map((dec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 text-indigo-600 font-bold">›</span>
                        <span>{dec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CHAT WITH DOCS */}
      {activeTab === 'chat' && (
        <div className="flex flex-col h-[520px]">
          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-xs">
                    <Bot className="size-4" />
                  </div>
                )}
                <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
                  <div
                    className={`rounded-2xl p-3.5 text-sm shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-tr-none'
                        : 'border border-slate-200 bg-slate-50 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                    {msg.time && (
                      <span className={`block text-[10px] mt-1.5 text-right ${msg.role === 'user' ? 'text-primary-foreground/75' : 'text-slate-400'}`}>
                        {msg.time}
                      </span>
                    )}
                  </div>

                  {/* Referenced segments timestamp pills */}
                  {msg.referenced_segments && msg.referenced_segments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-medium text-slate-500">Passage cité :</span>
                      {msg.referenced_segments.map((ref, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setActiveTab('transcript');
                            setSearchQuery(ref.replace(/[[\]]/g, ''));
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[11px] font-mono font-medium text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          <Clock className="size-3" />
                          {ref}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggested follow-up prompt pills */}
                  {msg.suggested_follow_ups && msg.suggested_follow_ups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.suggested_follow_ups.map((followUp, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendMessage(followUp)}
                          disabled={isSendingChat}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-primary hover:text-primary transition-all cursor-pointer shadow-2xs"
                        >
                          <span>{followUp}</span>
                          <ChevronRight className="size-3 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSendingChat && (
              <div className="flex gap-3 justify-start items-center text-slate-400 text-xs">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Bot className="size-4 animate-pulse" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-600">
                  <Loader2 className="size-3.5 animate-spin text-sky-600" />
                  <span>L'IA analyse la transcription du meet…</span>
                </div>
              </div>
            )}
            <div ref={chatScrollRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="border-t border-slate-200 bg-white p-3 sm:px-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Posez une question sur ce qui s'est dit durant le live…"
                disabled={isSendingChat}
                className="flex-1 text-sm bg-slate-50 border-slate-200 focus:bg-white"
              />
              <Button
                type="submit"
                disabled={!chatInput.trim() || isSendingChat}
                className="bg-primary hover:bg-primary/90 text-white shrink-0 px-3.5"
              >
                {isSendingChat ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                <span className="sr-only">Envoyer</span>
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
