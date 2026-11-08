import { CalendarDays, CalendarPlus, CalendarX2, Clock, Film, MapPin, PlayCircle, Radio, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@kodinga-mono-repo/ui';
import { EventAIReplayHub } from '@/pages/community-space/events/components/event-ai-replay-hub';
import EventFormModal from '@/pages/community-space/events/modals/event-form-modal';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { ReplayPlayer } from '@/pages/shared/replay-player';
import { eventTypeLabel, formatEventPlace } from '@/pages/community-space/events/event-labels';
import { useGetCommunityEventsQuery } from '@/utils/api/community/community.api';
import type { CommunityEvent } from '@/utils/api/event/event.type';
import type { CommunityPage } from '../form/UseCommunityPage';
import UseEventRsvp from '../form/UseEventRsvp';
import { EventRsvpActions } from './event-rsvp';
import { QuickLiveModal } from './quick-live-modal';
import { Pill, SectionHeader } from './section-header';
import { useRealtimeRegistrations } from '@/utils/realtime/use-realtime';

const PAGE_SIZE = 10;
const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' });
const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const hour = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** "18:30 – 20:00 (GMT)", in the visitor's time zone */
function timeRange(event: CommunityEvent) {
  const start = new Date(event.start_time);
  const zone = new Intl.DateTimeFormat('fr-FR', { timeZoneName: 'short' }).formatToParts(start).find((p) => p.type === 'timeZoneName')?.value;
  return `${hour.format(start)} – ${hour.format(new Date(event.end_time))}${zone ? ` (${zone})` : ''}`;
}

/** Replay of a past event, opened on demand (the player loads hls.js only then) */
function PastEventReplay({ event, page }: { event: CommunityEvent; page: CommunityPage }) {
  const [open, setOpen] = useState(false);
  if (!event.replay_video_asset) return <p className="text-sm text-slate-500">Pas de replay pour cet événement.</p>;
  if (!page.canSee) return <p className="text-sm text-slate-500">Replay réservé aux membres de la communauté.</p>;
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="flex items-center gap-1.5 border-emerald-600/40 text-emerald-800 bg-emerald-50 hover:bg-emerald-100">
        <PlayCircle className="size-4 text-emerald-600" /> Voir le replay & IA
      </Button>
    );
  }
  return <EventAIReplayHub slug={page.slug} event={event} canManage={page.canManage} className="mt-3" />;
}

/** Rich video replay card for the dedicated video hub gallery */
function ReplayCard({ event, page }: { event: CommunityEvent; page: CommunityPage }) {
  const [playing, setPlaying] = useState(false);
  const [openHub, setOpenHub] = useState(false);
  const start = new Date(event.start_time);

  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md transition-shadow">
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
        {playing && event.replay_video_asset ? (
          <ReplayPlayer video={event.replay_video_asset} title={event.title} className="size-full rounded-none" />
        ) : (
          <>
            {event.cover_image_url ? (
              <img src={event.cover_image_url} alt="" className="size-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <GlassBackdrop fade={false} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              title="Lire la vidéo du replay"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-red-600 text-white shadow-xl shadow-red-600/50 group-hover:scale-110 transition-transform">
                <PlayCircle className="size-8" />
              </div>
            </button>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
              <Film className="size-3 text-red-400" />
              Replay vidéo
            </div>
            {event.duration_minutes ? (
              <div className="absolute bottom-3 right-3 rounded-md bg-black/75 px-2 py-0.5 text-xs font-mono font-medium text-white backdrop-blur-sm">
                {event.duration_minutes} min
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <CalendarDays className="size-3.5 text-slate-400" />
          <span>{day.format(start)} {month.format(start)}</span>
          <span>•</span>
          <span>{timeRange(event)}</span>
        </div>

        <h3 className="mt-2 text-lg font-semibold text-slate-900 group-hover:text-blue-900 transition-colors line-clamp-1">
          {event.title}
        </h3>

        {event.description && (
          <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {event.host && (
              <span className="truncate">Animé par <strong className="text-slate-800">{event.host.full_name || event.host.username}</strong></span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpenHub((v) => !v)}
              className="text-xs font-semibold border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 gap-1.5"
            >
              <Sparkles className="size-3.5 text-emerald-600" />
              {openHub ? 'Masquer IA' : 'Transcription & Chat IA'}
            </Button>
            {!playing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPlaying(true)}
                className="text-xs font-semibold text-slate-800 hover:text-black border-slate-300"
              >
                <PlayCircle className="size-3.5 text-red-600" /> Regarder
              </Button>
            )}
          </div>
        </div>

        {openHub && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <EventAIReplayHub slug={page.slug} event={event} canManage={page.canManage} />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Events of the community (public): the upcoming ones (GET .../events/?upcoming=true) to register
 * to, the past ones (status=completed) with their replay, and dedicated video replay gallery
 */
export function EventsTab({ page }: { page: CommunityPage }) {
  const slug = page.slug;
  const rsvp = UseEventRsvp(slug);
  const [view, setView] = useState<'upcoming' | 'replays' | 'past'>('upcoming');
  const [count, setCount] = useState(PAGE_SIZE);
  const [quickLiveOpen, setQuickLiveOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const past = view === 'past';
  const isReplays = view === 'replays';

  const isOwner = page.role === 'owner';
  const hasLivePermission = Boolean(
    page.community?.user_membership?.can_start_live ||
    (page.community?.user_membership?.permissions as string[] | undefined)?.includes('can_start_live') ||
    (page.role && page.community?.settings?.all_role_permissions?.[page.role as 'admin' | 'moderator' | 'member']?.['can_start_live'])
  );
  const canStartLive = isOwner || hasLivePermission;
  const canCreate = page.isTeam || (page.community?.user_membership?.permissions as string[] | undefined)?.includes('can_create_events');

  const pollingInterval = useRealtimeRegistrations(page.community?.id);
  const { data, isLoading, isFetching } = useGetCommunityEventsQuery(
    isReplays
      ? { slug, has_replay: true, page: 1, page_size: count }
      : past
      ? { slug, status: 'completed', page: 1, page_size: count }
      : { slug, upcoming: true, page: 1, page_size: count },
    // The registrations of the upcoming ones only move
    { pollingInterval: isReplays || past ? 0 : pollingInterval },
  );
  const events = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader eyebrow="Se retrouver" title="Événements" aside={<CalendarDays className="size-7 text-amber-600" aria-hidden />}>
          Ateliers, lives et rencontres à venir dans la communauté. Inscrivez-vous pour recevoir le lien et l’ajouter à votre agenda.
        </SectionHeader>

        {(canStartLive || canCreate) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canStartLive && (
              <Button
                onClick={() => setQuickLiveOpen(true)}
                className="bg-red-600 font-semibold text-white shadow-md shadow-red-600/25 hover:bg-red-500"
              >
                <Radio className="size-4 animate-pulse" /> Démarrer un direct
              </Button>
            )}
            {canCreate && (
              <Button variant="outline" onClick={() => setScheduleOpen(true)}>
                <CalendarPlus className="size-4" /> Programmer
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Période">
        {(
          [
            ['upcoming', 'À venir'],
            ['replays', '📹 Replays vidéo'],
            ['past', 'Passés et replays'],
          ] as const
        ).map(([id, label]) => (
          <Pill
            key={id}
            active={view === id}
            onClick={() => {
              setView(id);
              setCount(PAGE_SIZE);
            }}
          >
            {label}
          </Pill>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement des événements…</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          {isReplays ? <Film className="size-8 text-slate-300" /> : <CalendarX2 className="size-8 text-slate-300" />}
          <p className="mt-3 font-semibold text-slate-900">
            {isReplays
              ? 'Aucun replay vidéo disponible'
              : past
              ? 'Aucun événement passé'
              : 'Aucun événement à venir'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {isReplays
              ? 'Les replays des lives enregistrés apparaîtront dans cette galerie.'
              : past
              ? 'Les événements terminés apparaîtront ici.'
              : 'Les lives, ateliers et rencontres apparaîtront ici.'}
          </p>
        </div>
      ) : isReplays ? (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6" aria-label="Replays vidéo de la communauté">
            {events.map((event) => (
              <ReplayCard key={event.id} event={event} page={page} />
            ))}
          </ul>
          {events.length < total && (
            <Button variant="outline" className="mx-auto mt-6 flex" isLoading={isFetching} onClick={() => setCount((n) => n + PAGE_SIZE)}>
              Afficher plus de replays
            </Button>
          )}
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-6" aria-label={past ? 'Événements passés' : 'Événements à venir'}>
            {events.map((event) => {
              const start = new Date(event.start_time);
              return (
                <li key={event.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="relative h-36">
                    {event.cover_image_url ? (
                      <img src={event.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <GlassBackdrop fade={false} />
                    )}
                    {event.status === 'live' && (
                      <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                        <span className="size-1.5 animate-pulse rounded-full bg-white" /> En direct
                      </span>
                    )}
                  </div>
                  <div className="flex gap-5 p-6">
                    <div className="flex h-20 w-18 shrink-0 flex-col items-center justify-center self-center rounded-xl bg-blue-900 text-white">
                      <span className="text-2xl leading-none font-semibold">{day.format(start)}</span>
                      <span className="mt-2 text-xs tracking-wide uppercase">{month.format(start).replace('.', '')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold tracking-wide text-blue-900 uppercase">{eventTypeLabel[event.event_type]}</p>
                      <h3 className="mt-1 text-xl text-slate-900">{event.title}</h3>
                      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-4 text-slate-400" /> {timeRange(event)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-4 text-slate-400" /> {formatEventPlace(event)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="size-4 text-slate-400" /> {event.attendees_count} participant{event.attendees_count > 1 ? 's' : ''}
                          {event.max_attendees ? ` / ${event.max_attendees}` : ''}
                        </span>
                      </p>
                      {event.description && <p className="mt-3 line-clamp-3 text-sm text-slate-600">{event.description}</p>}
                      <div className="mt-4">
                        {past ? <PastEventReplay event={event} page={page} /> : <EventRsvpActions event={event} page={page} rsvp={rsvp} />}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {events.length < total && (
            <Button variant="outline" className="mx-auto mt-6 flex" isLoading={isFetching} onClick={() => setCount((n) => n + PAGE_SIZE)}>
              Afficher plus
            </Button>
          )}
        </>
      )}

      {canCreate && (
        <>
          <QuickLiveModal slug={slug} open={quickLiveOpen} onClose={() => setQuickLiveOpen(false)} />
          <EventFormModal slug={slug} open={scheduleOpen} event={null} onClose={() => setScheduleOpen(false)} />
        </>
      )}
    </section>
  );
}
