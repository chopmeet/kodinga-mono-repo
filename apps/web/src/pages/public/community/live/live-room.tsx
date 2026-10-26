import '@livekit/components-styles';

import {
  Chat,
  ControlBar,
  FocusLayout,
  GridLayout,
  isTrackReference,
  ParticipantTile,
  RoomAudioRenderer,
  RoomContext,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  ArrowLeft,
  CalendarClock,
  Camera,
  CameraOff,
  Check,
  CircleStop,
  Copy,
  MessageSquare,
  Mic,
  MicOff,
  Radio,
  Share2,
  Smile,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, Button, cn, customToast, Loader } from '@kodinga-mono-repo/ui';
import { formatEventWhen } from '@/pages/community-space/events/event-labels';
import { nameInitials } from '@/utils/Utils';
import UseLiveRoom, { type LiveRoom } from './form/UseLiveRoom';
import { useRoomConnection } from './form/useRoomConnection';

/** The speakers (host and presenters): their screen first, else their camera */
function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const speakers = tracks.filter((t) => t.participant.permissions?.canPublish);
  const screen = speakers.find((t) => t.source === Track.Source.ScreenShare && isTrackReference(t));
  const cameras = speakers.filter((t) => t.source === Track.Source.Camera);

  if (screen && isTrackReference(screen)) {
    return <FocusLayout trackRef={screen} className="h-full rounded-2xl overflow-hidden shadow-2xl" />;
  }

  if (cameras.length === 0) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-8 text-center text-white/70 shadow-2xl">
        <div className="relative flex size-20 items-center justify-center rounded-2xl bg-red-600/10 text-red-500 ring-1 ring-red-500/30">
          <Radio className="size-10 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-red-500" />
          </span>
        </div>
        <div className="max-w-md space-y-1.5">
          <p className="text-lg font-semibold text-white">L’organisateur va bientôt prendre la parole</p>
          <p className="text-sm text-slate-400">
            Installez-vous confortablement. La diffusion vidéo et audio démarrera automatiquement dès le lancement.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-slate-300">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          Microphone et vidéo prêts
        </div>
      </div>
    );
  }

  return (
    <GridLayout tracks={cameras} className="h-full rounded-2xl overflow-hidden shadow-2xl">
      <ParticipantTile />
    </GridLayout>
  );
}

function Audience() {
  const participants = useParticipants();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90 hover:bg-white/15 transition-colors"
      aria-label={`${participants.length} dans la salle`}
    >
      <Users className="size-3.5 text-red-400" aria-hidden /> {participants.length}
    </span>
  );
}

/** Floating reaction animated bubble */
type ReactionItem = { id: string; emoji: string; left: number };

function FloatingReactionsOverlay({ reactions }: { reactions: ReactionItem[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {reactions.map((r) => (
        <span
          key={r.id}
          style={{ left: `${r.left}%` }}
          className="absolute bottom-16 animate-[floatUp_2.5s_ease-out_forwards] text-3xl select-none"
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

/** Participants List Drawer */
function ParticipantsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const participants = useParticipants();
  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl sm:w-96">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white">
          <Users className="size-4 text-red-400" /> Participants ({participants.length})
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <ul className="mt-3 divide-y divide-white/5 overflow-y-auto space-y-1">
        {participants.map((p) => {
          const isHost = p.permissions?.canPublish;
          const name = p.name || p.identity;
          return (
            <li key={p.sid || p.identity} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-red-950 text-xs font-semibold text-red-200">
                    {nameInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{name}</p>
                  <p className="text-xs text-slate-400">
                    {isHost ? '⭐ Organisateur' : 'Participant'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                {p.isSpeaking && (
                  <span className="flex size-2 rounded-full bg-emerald-400 animate-ping" />
                )}
                {p.isMicrophoneEnabled ? (
                  <Mic className="size-3.5 text-emerald-400" />
                ) : (
                  <MicOff className="size-3.5 text-slate-500" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Connected Live Room: Video Stage, Chat, Audience Drawer, Reaction Overlays & Controls */
function Room({ live, session }: { live: LiveRoom; session: NonNullable<LiveRoom['session']> }) {
  const room = useRoomConnection({
    serverUrl: live.serverUrl,
    token: session.token,
    isHost: live.isHost,
    onLeft: live.leave,
  });

  const e = live.event;
  const [chatOpen, setChatOpen] = useState(true);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [showShareSuccess, setShowShareSuccess] = useState(false);

  // Live elapsed timer
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    if (e?.status !== 'live') return;
    const interval = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [e?.status]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendReaction = (emoji: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const left = Math.floor(Math.random() * 50) + 25; // center 25%-75%
    setReactions((prev) => [...prev, { id, emoji, left }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2600);
  };

  const copyLiveLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowShareSuccess(true);
      customToast.success({ message: 'Lien du live copié dans le presse-papier !' });
      setTimeout(() => setShowShareSuccess(false), 2000);
    } catch {
      customToast.error({ message: 'Impossible de copier le lien automatiquement.' });
    }
  };

  if (!e) return null;
  const isLive = e.status === 'live';

  return (
    <RoomContext.Provider value={room}>
      <div data-lk-theme="default" className="relative flex h-[calc(100dvh-4.5rem)] flex-col bg-slate-950 text-white select-none overflow-hidden">
        {/* Live Studio Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-2.5 backdrop-blur-md z-30">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={live.back}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Retour aux événements"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-white sm:text-base">{e.title}</h1>
              <p className="text-xs text-slate-400 truncate">
                {e.host ? `Animé par ${e.host.full_name || e.host.username}` : 'Événement interactif'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isLive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm shadow-red-600/50">
                <span className="size-1.5 animate-pulse rounded-full bg-white" /> En direct
                <span className="ml-1 text-[11px] font-mono font-medium text-red-100">
                  {formatTimer(secondsElapsed)}
                </span>
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                Salle d’attente
              </span>
            )}

            <button
              type="button"
              onClick={() => setParticipantsOpen(true)}
              className="cursor-pointer"
              title="Voir les participants"
            >
              <Audience />
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={copyLiveLink}
              className="hidden sm:inline-flex bg-white text-black border-slate-200 hover:bg-slate-100 hover:text-black font-semibold shadow-xs transition-colors"
              title="Inviter des personnes"
            >
              {showShareSuccess ? <Check className="size-3.5 text-emerald-600" /> : <Share2 className="size-3.5 text-black" />}
              Partager
            </Button>

            <button
              type="button"
              onClick={() => setChatOpen(!chatOpen)}
              className={cn(
                'flex size-8 items-center justify-center rounded-lg border transition-colors',
                chatOpen
                  ? 'border-red-500/50 bg-red-600/20 text-red-400'
                  : 'border-white/10 text-slate-400 hover:bg-white/10 hover:text-white',
              )}
              title="Afficher/Masquer le chat"
            >
              <MessageSquare className="size-4" />
            </button>

            {live.isHost &&
              (isLive ? (
                <Button size="sm" variant="danger" isLoading={live.isUpdating} onClick={live.end}>
                  <CircleStop className="size-4" /> Terminer le live
                </Button>
              ) : (
                <Button
                  size="sm"
                  isLoading={live.isUpdating}
                  onClick={live.start}
                  className="bg-red-600 font-semibold text-white shadow-md shadow-red-600/30 hover:bg-red-500"
                >
                  <Radio className="size-4 animate-pulse" /> Démarrer le live
                </Button>
              ))}
          </div>
        </header>

        {/* Center Stage & Chat Layout */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden p-3 gap-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl">
            <Stage />
            <FloatingReactionsOverlay reactions={reactions} />

            {/* Quick interactive reaction bar */}
            <div className="absolute bottom-6 right-6 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/90 p-1.5 shadow-2xl backdrop-blur-md">
              <span className="pl-2 pr-1 text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Smile className="size-3.5 text-amber-400" />
              </span>
              {[
                { emoji: '👏', label: 'Applaudir' },
                { emoji: '❤️', label: 'J’adore' },
                { emoji: '🔥', label: 'Génial' },
                { emoji: '🚀', label: 'Au top' },
                { emoji: '💡', label: 'Pertinent' },
                { emoji: '🎉', label: 'Bravo' },
              ].map(({ emoji, label }) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  title={label}
                  className="size-8 rounded-full text-base transition-transform hover:scale-130 active:scale-95 flex items-center justify-center hover:bg-white/10 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Right chat panel */}
          {chatOpen && (
            <aside
              aria-label="Chat du live"
              className="live-chat-panel relative flex w-80 sm:w-88 lg:w-96 shrink-0 min-h-0 flex-col rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl overflow-hidden z-20 max-md:fixed max-md:inset-x-3 max-md:bottom-18 max-md:top-18 max-md:w-auto"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-slate-900/80">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-red-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">Chat en direct</span>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title="Fermer le chat"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <Chat className="h-full w-full" />
              </div>
            </aside>
          )}
        </div>

        {/* Media Control Bar */}
        <div className="border-t border-white/10 bg-slate-900/90 backdrop-blur-md px-4 py-2 z-20">
          <ControlBar
            variation="minimal"
            controls={{
              camera: live.isHost,
              microphone: live.isHost,
              screenShare: live.isHost,
              chat: false,
              leave: true,
              settings: false,
            }}
          />
        </div>

        <ParticipantsDrawer open={participantsOpen} onClose={() => setParticipantsOpen(false)} />
        <RoomAudioRenderer />
      </div>
    </RoomContext.Provider>
  );
}

/** Pre-join device preview tester (webcam & microphone check) */
function DevicePreviewTester({ isHost }: { isHost: boolean }) {
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isHost) return;
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        // Ignored if permissions are not yet granted in browser
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [isHost]);

  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !videoEnabled;
      });
    }
    setVideoEnabled(!videoEnabled);
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !audioEnabled;
      });
    }
    setAudioEnabled(!audioEnabled);
  };

  if (!isHost) return null;

  return (
    <div className="relative mx-auto mt-2 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
      <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center">
        {videoEnabled ? (
          <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover -scale-x-100" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <CameraOff className="size-8" />
            <span className="text-xs">Caméra désactivée</span>
          </div>
        )}

        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1.5 backdrop-blur-md ring-1 ring-white/10">
          <button
            type="button"
            onClick={toggleVideo}
            className={cn(
              'flex size-8 items-center justify-center rounded-full transition-colors',
              videoEnabled ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-red-600 text-white',
            )}
            title={videoEnabled ? 'Couper la caméra' : 'Activer la caméra'}
          >
            {videoEnabled ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
          </button>
          <button
            type="button"
            onClick={toggleAudio}
            className={cn(
              'flex size-8 items-center justify-center rounded-full transition-colors',
              audioEnabled ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-red-600 text-white',
            )}
            title={audioEnabled ? 'Couper le micro' : 'Activer le micro'}
          >
            {audioEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          </button>
        </div>
      </div>
      <div className="p-2.5 text-center text-xs text-slate-400">
        Aperçu de votre caméra avant de rejoindre
      </div>
    </div>
  );
}

/** Before joining: when, who, device checks, and joining actions */
function Lobby({ live }: { live: LiveRoom }) {
  const e = live.event;
  if (!e) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      customToast.success({ message: 'Lien du live copié !' });
    } catch {
      customToast.error({ message: 'Copiez l’adresse dans la barre du navigateur.' });
    }
  };

  let action;
  if (e.format !== 'livekit') {
    action = (
      <p className="text-slate-400">
        Cet événement ne se déroule pas dans un salon Kodinga : le lien est sur la page de la communauté.
      </p>
    );
  } else if (e.status === 'cancelled') {
    action = <p className="text-amber-400 font-medium">Cet événement a été annulé.</p>;
  } else if (e.status === 'completed') {
    action = (
      <div className="space-y-3">
        <p className="text-slate-300">Ce live est terminé. Merci d’avoir suivi la communauté !</p>
        <Button asChild variant="outline" className="border-white/10 text-white hover:bg-white/10">
          <Link to={live.back}>Retour aux événements</Link>
        </Button>
      </div>
    );
  } else if (!live.signedIn) {
    action = (
      <Button asChild size="lg" className="bg-blue-600 font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30">
        <Link to={live.loginUrl}>Se connecter pour rejoindre</Link>
      </Button>
    );
  } else {
    action = (
      <div className="flex flex-col items-center gap-3 w-full">
        <Button
          size="lg"
          isLoading={live.isJoining}
          onClick={live.join}
          className={cn(
            'w-full max-w-sm font-semibold shadow-xl transition-all',
            e.status === 'live'
              ? 'bg-red-600 text-white shadow-red-600/30 hover:bg-red-500 hover:scale-102'
              : 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500 hover:scale-102',
          )}
        >
          <Radio className="size-5 animate-pulse" />
          {e.status === 'live' ? 'Rejoindre le live' : 'Entrer dans la salle d’attente'}
        </Button>
        {e.status !== 'live' && (
          <p className="text-sm text-slate-400">
            L’organisateur n’a pas encore démarré : la vidéo commencera dès son lancement.
          </p>
        )}
      </div>
    );
  }

  const isLive = e.status === 'live';

  return (
    <section className="relative mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-16 text-center">
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className={cn('size-72 rounded-full blur-3xl opacity-20', isLive ? 'bg-red-600' : 'bg-blue-600')} />
      </div>

      <div className="relative">
        <span
          className={cn(
            'flex size-16 items-center justify-center rounded-2xl ring-1 shadow-2xl transition-transform hover:scale-105',
            isLive
              ? 'bg-red-600/20 text-red-500 ring-red-500/30'
              : 'bg-blue-600/20 text-blue-400 ring-blue-500/30',
          )}
          aria-hidden
        >
          <Radio className={cn('size-8', isLive && 'animate-pulse')} />
        </span>
        {isLive && (
          <span className="absolute -top-1 -right-1 flex size-3.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-3.5 rounded-full bg-red-500" />
          </span>
        )}
      </div>

      {isLive ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-red-600/40 animate-pulse">
          <span className="size-2 rounded-full bg-white" /> En direct
        </span>
      ) : (
        <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300">
          Événement programmé
        </span>
      )}

      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">{e.title}</h1>

      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-4 text-slate-400" aria-hidden />
          {formatEventWhen(e)}
        </span>
        <span className="text-slate-600">•</span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-4 text-slate-400" />
          {e.attendees_count} participant{e.attendees_count > 1 ? 's' : ''}
        </span>
      </div>

      {e.host && (
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-slate-300">
          <Avatar className="size-5">
            {e.host.avatar_url && <AvatarImage src={e.host.avatar_url} alt="" />}
            <AvatarFallback className="bg-slate-800 text-[10px]">
              {nameInitials(e.host.full_name || e.host.username)}
            </AvatarFallback>
          </Avatar>
          <span>Animé par {e.host.full_name || e.host.username}</span>
        </div>
      )}

      {/* Pre-join preview if logged in */}
      {live.signedIn && e.status !== 'completed' && e.status !== 'cancelled' && (
        <DevicePreviewTester isHost={e.host_id === live.event?.host?.id} />
      )}

      <div className="mt-2 flex w-full flex-col items-center gap-4">{action}</div>

      <button
        type="button"
        onClick={copyLink}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <Copy className="size-3.5" /> Copier le lien du live pour inviter
      </button>
    </section>
  );
}

/** /communities/:slug/events/:eventId/live — the live room of an event */
function LiveRoomPage() {
  const live = UseLiveRoom();

  if (live.isLoading) return <Loader inline className="py-24" message="Chargement du live…" />;

  if (!live.event) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {live.notFound ? 'Événement introuvable' : 'Impossible de charger l’événement'}
        </h1>
        <Button asChild variant="outline">
          <Link to={live.back}>Retour aux événements</Link>
        </Button>
      </section>
    );
  }

  if (live.session) return <Room live={live} session={live.session} />;

  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="mx-auto max-w-285 px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          to={live.back}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-4" /> Événements de la communauté
        </Link>
      </div>
      <Lobby live={live} />
    </div>
  );
}

export default LiveRoomPage;
