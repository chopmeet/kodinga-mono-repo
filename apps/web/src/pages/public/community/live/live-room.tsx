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
import { ArrowLeft, CalendarClock, CircleStop, Radio, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, cn, Loader } from '@kodinga-mono-repo/ui';
import { formatEventWhen } from '@/pages/community-space/events/event-labels';
import UseLiveRoom, { type LiveRoom } from './form/UseLiveRoom';
import { useRoomConnection } from './form/useRoomConnection';

/** The speakers (those allowed to publish: the host): their screen first, else their camera */
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

  if (screen && isTrackReference(screen)) return <FocusLayout trackRef={screen} className="h-full" />;
  if (cameras.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-white/70">
        <Radio className="size-8" aria-hidden />
        <p className="font-medium text-white">L’organisateur va bientôt prendre la parole</p>
        <p className="text-sm">Restez dans la salle : la vidéo apparaîtra ici.</p>
      </div>
    );
  }
  return (
    <GridLayout tracks={cameras} className="h-full">
      <ParticipantTile />
    </GridLayout>
  );
}

function Audience() {
  const participants = useParticipants();
  return (
    <span className="flex items-center gap-1.5 text-sm text-white/80" aria-label={`${participants.length} dans la salle`}>
      <Users className="size-4" aria-hidden /> {participants.length}
    </span>
  );
}

/** Connected: the stage, the chat, the controls (camera, micro, screen for the host; leave) */
function Room({ live, session }: { live: LiveRoom; session: NonNullable<LiveRoom['session']> }) {
  const room = useRoomConnection({ serverUrl: live.serverUrl, token: session.token, isHost: live.isHost, onLeft: live.leave });
  const e = live.event;
  if (!e) return null;
  const isLive = e.status === 'live';
  return (
    <RoomContext.Provider value={room}>
      <div data-lk-theme="default" className="flex h-[calc(100dvh-4.5rem)] flex-col bg-slate-950">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
          <h1 className="min-w-0 flex-1 truncate font-semibold text-white">{e.title}</h1>
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> En direct
            </span>
          ) : (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80">Salle d’attente</span>
          )}
          <Audience />
          {live.isHost &&
            (isLive ? (
              <Button size="sm" variant="danger" isLoading={live.isUpdating} onClick={live.end}>
                <CircleStop /> Terminer le live
              </Button>
            ) : (
              <Button size="sm" isLoading={live.isUpdating} onClick={live.start}>
                <Radio /> Démarrer le live
              </Button>
            ))}
        </header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_340px]">
          <div className="min-h-0 p-2">
            <Stage />
          </div>
          <aside aria-label="Chat du live" className="hidden min-h-0 border-l border-white/10 lg:flex lg:flex-col">
            <Chat className="h-full" />
          </aside>
        </div>
        <ControlBar
          variation="minimal"
          controls={{ camera: live.isHost, microphone: live.isHost, screenShare: live.isHost, chat: false, leave: true, settings: false }}
        />
        <RoomAudioRenderer />
      </div>
    </RoomContext.Provider>
  );
}

/** Before joining: when, who, and the reasons not to (finished, cancelled, not a Kodinga live) */
function Lobby({ live }: { live: LiveRoom }) {
  const e = live.event;
  if (!e) return null;
  let action;
  if (e.format !== 'livekit') {
    action = <p className="text-slate-600">Cet événement ne se déroule pas dans un salon Kodinga : le lien est sur la page de la communauté.</p>;
  } else if (e.status === 'cancelled') {
    action = <p className="text-slate-600">Cet événement a été annulé.</p>;
  } else if (e.status === 'completed') {
    action = <p className="text-slate-600">Ce live est terminé. Merci d’avoir suivi la communauté !</p>;
  } else if (!live.signedIn) {
    action = (
      <Button asChild size="lg">
        <Link to={live.loginUrl}>Se connecter pour rejoindre</Link>
      </Button>
    );
  } else {
    action = (
      <>
        <Button size="lg" isLoading={live.isJoining} onClick={live.join}>
          <Radio /> {e.status === 'live' ? 'Rejoindre le live' : 'Entrer dans la salle d’attente'}
        </Button>
        {e.status !== 'live' && <p className="text-sm text-slate-500">L’organisateur n’a pas encore démarré : la vidéo commencera dès son lancement.</p>}
      </>
    );
  }
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-20 text-center">
      <span className={cn('flex size-14 items-center justify-center rounded-full', e.status === 'live' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-900')} aria-hidden>
        <Radio className="size-7" />
      </span>
      {e.status === 'live' && <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">En direct</span>}
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{e.title}</h1>
      <p className="flex items-center gap-1.5 text-slate-600">
        <CalendarClock className="size-4" aria-hidden /> {formatEventWhen(e)}
      </p>
      {e.host && <p className="text-sm text-slate-500">Animé par {e.host.full_name || e.host.username}</p>}
      <div className="mt-2 flex flex-col items-center gap-3">{action}</div>
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
        <h1 className="text-2xl font-bold text-slate-900">{live.notFound ? 'Événement introuvable' : 'Impossible de charger l’événement'}</h1>
        <Button asChild variant="outline">
          <Link to={live.back}>Retour aux événements</Link>
        </Button>
      </section>
    );
  }
  if (live.session) return <Room live={live} session={live.session} />;
  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="mx-auto max-w-285 px-4 pt-6 sm:px-6 lg:px-8">
        <Link to={live.back} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Événements de la communauté
        </Link>
      </div>
      <Lobby live={live} />
    </div>
  );
}

export default LiveRoomPage;
