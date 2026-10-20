import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ArrowLeft, CalendarPlus, Clock, Eye, EyeOff, Link2, MapPin, Pencil, PlayCircle, Upload, UserRound, Users, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge, Button, ColgateWrapper, DataTable, DetailsPageSkeleton, EmptyAlert, Pagination, SearchInput } from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { ReplayPlayer } from '@/pages/shared/replay-player';
import { dateFormat, RowActions } from '@/pages/shared/row-actions';
import { useGetCommunityEventQuery } from '@/utils/api/community/community.api';
import type { CommunityEvent, EventAttendee, RsvpStatus } from '@/utils/api/event/event.type';
import { ApiBaseUrl } from '@/utils/http';
import { useCommunitySpace } from '../community-space-context';
import { eventFormatLabel, eventStatusStyle, eventTypeLabel, formatEventPlace, formatEventWhen } from './event-labels';
import UseEventActions from './form/UseEventActions';
import UseEventAttendees, { type AttendeeFilter } from './form/UseEventAttendees';
import UseEventReplay, { REPLAY_MAX_GB, REPLAY_TYPES } from './form/UseEventReplay';
import EventFormModal from './modals/event-form-modal';

const rsvpLabel: Record<RsvpStatus, { label: string; className: string }> = {
  attending: { label: 'Inscrit', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  maybe: { label: 'Peut-être', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  declined: { label: 'Ne vient pas', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

function Attendees({ slug, eventId }: { slug: string; eventId: string }) {
  const list = UseEventAttendees(slug, eventId);
  const { isLoading, rows: attendees } = list;

  if (!isLoading && list.total === 0) return <EmptyAlert text="Personne n'est encore inscrit." />;
  const filters: { id: AttendeeFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: list.counts.all },
    { id: 'attending', label: 'Inscrits', count: list.counts.attending },
    { id: 'maybe', label: 'Intéressés', count: list.counts.maybe },
    { id: 'checked_in', label: 'Présents', count: list.counts.checked_in },
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={list.search}
          onValueChange={list.setSearch}
          placeholder="Rechercher un participant…"
          label="Rechercher un participant"
          className="w-full sm:w-72"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les participants">
          {filters.map((f) => (
            <FilterChip key={f.id} active={list.filter === f.id} onClick={() => list.setFilter(f.id)}>
              {f.label} ({f.count})
            </FilterChip>
          ))}
        </div>
      </div>
      {!isLoading && list.matching === 0 ? (
        <EmptyAlert text="Aucun participant ne correspond à cette recherche." />
      ) : (
        <>
          <DataTable<EventAttendee, unknown>
            isLoading={isLoading}
            data={attendees}
            columns={[
              {
                id: 'member',
                header: 'Membre',
                cell: ({ row }) => (
                  <div className="min-w-40">
                    <p className="font-medium text-slate-900">{row.original.user.full_name || row.original.user.username}</p>
                    <p className="text-xs text-slate-500">@{row.original.user.username}</p>
                  </div>
                ),
              },
              {
                id: 'status',
                header: 'Réponse',
                cell: ({ row }) => {
                  const s = rsvpLabel[row.original.status] ?? rsvpLabel.attending;
                  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
                },
              },
              {
                id: 'date',
                header: 'Inscrit le',
                cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{dateFormat.format(new Date(row.original.created_at))}</span>,
              },
              {
                id: 'checkin',
                header: 'Présence',
                cell: ({ row }) => <span className="text-slate-600">{row.original.checked_in_at ? 'Présent' : '—'}</span>,
              },
            ]}
          />
          {list.matching > 0 && (
            <Pagination totalItems={list.matching} currentPage={list.page} perPage={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} />
          )}
        </>
      )}
    </>
  );
}

/** Replay of the event: watched by the team; the managers add (or replace) it once the live is over */
function ReplayPanel({ slug, event, canManage }: { slug: string; event: CommunityEvent; canManage: boolean }) {
  const replay = UseEventReplay(slug, event);
  const video = event.replay_video_asset;
  return (
    <section aria-labelledby="replay-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="replay-title" className="flex items-center gap-2 font-semibold text-slate-900">
          <PlayCircle className="size-5 text-primary" /> Replay
        </h2>
        {canManage && !replay.isUploading && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50">
              <Upload className="size-4" />
              {video ? 'Remplacer la vidéo' : 'Ajouter la vidéo du replay'}
              <input
                type="file"
                accept={REPLAY_TYPES.join(',')}
                aria-label="Fichier du replay"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) replay.upload(file);
                }}
              />
            </label>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-400" title="Bientôt disponible">
              <Link2 className="size-4" /> Lien vidéo · bientôt
            </span>
          </div>
        )}
      </div>
      {replay.isUploading && (
        <div className="mt-4" role="status">
          <p className="text-sm text-slate-600">Envoi de la vidéo vers Mux… {replay.progress} %</p>
          <div className="mt-2 h-2 rounded-full bg-slate-100" role="progressbar" aria-label="Envoi du replay" aria-valuenow={replay.progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${replay.progress ?? 0}%` }} />
          </div>
        </div>
      )}
      {replay.error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {replay.error}
        </p>
      )}
      <div className="mt-4">
        {video ? (
          <ReplayPlayer video={video} title={event.title} className="max-w-3xl" />
        ) : (
          <p className="text-sm text-slate-500">
            {canManage ? `Ajoutez l’enregistrement du live (MP4, WebM ou MOV, ${REPLAY_MAX_GB} Go au maximum) : les membres pourront le revoir.` : 'Pas encore de replay pour cet événement.'}
          </p>
        )}
      </div>
    </section>
  );
}

/** /c/:slug/events/:eventId — one event, its actions and its attendees */
function EventDetails() {
  const { community } = useCommunitySpace();
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const back = `/c/${community.slug}/events`;
  const [preparing, setPreparing] = useState(false);
  // While Mux prepares the replay, the event is read again
  const { data: event, isLoading, error } = useGetCommunityEventQuery({ slug: community.slug, eventId }, { skip: !eventId, pollingInterval: preparing ? 15_000 : 0 });
  const replayStatus = event?.replay_video_asset?.status;
  useEffect(() => setPreparing(replayStatus === 'waiting' || replayStatus === 'preparing'), [replayStatus]);
  const [editing, setEditing] = useState(false);
  const { canManage, actionsFor, confirmDialog } = UseEventActions({ onEdit: () => setEditing(true), afterDelete: () => navigate(back) });

  if (isLoading) return <DetailsPageSkeleton />;
  if (!event) {
    const notFound = (error as FetchBaseQueryError | undefined)?.status === 404;
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyAlert text={notFound ? 'Cet événement est introuvable ou a été supprimé.' : "Impossible de charger l'événement."} />
        <Button asChild variant="outline" size="sm">
          <Link to={back}>Retour aux événements</Link>
        </Button>
      </div>
    );
  }

  const status = eventStatusStyle[event.status];
  const seats = event.max_attendees ? `${event.attendees_count} / ${event.max_attendees}` : String(event.attendees_count);
  const facts = [
    { icon: Clock, label: 'Quand', value: formatEventWhen(event) },
    { icon: MapPin, label: 'Où', value: `${formatEventPlace(event)}${event.location_address ? ` — ${event.location_address}` : ''}` },
    { icon: UserRound, label: 'Animé par', value: event.host?.full_name || event.host?.username || '—' },
    { icon: Users, label: 'Inscrits', value: `${seats}${event.is_full ? ' (complet)' : ''}` },
    { icon: event.is_public ? Eye : EyeOff, label: 'Visibilité', value: event.is_public ? 'Public' : 'Membres uniquement' },
    { icon: Video, label: 'Format', value: `${eventFormatLabel[event.format]}${event.is_recorded ? ' · enregistré' : ''}` },
  ];

  return (
    <div className="community__event">
      <Link to={back} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" />
        Événements
      </Link>

      <ColgateWrapper className="overflow-hidden border border-neutral-200 p-0">
        <div className="relative h-40">
          {event.cover_image_url ? <img src={event.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={status.className}>
                {event.status === 'live' && <span className="size-1.5 animate-pulse rounded-full bg-red-600" />}
                {status.label}
              </Badge>
              <Badge variant="outline" className="text-slate-600">
                {eventTypeLabel[event.event_type]}
              </Badge>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{event.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`${ApiBaseUrl}communities/${community.slug}/events/${event.id}/calendar.ics`}>
                <CalendarPlus />
                Ajouter à l'agenda
              </a>
            </Button>
            {canManage && event.status === 'scheduled' && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil />
                Modifier
              </Button>
            )}
            <RowActions label={`Actions pour ${event.title}`} actions={actionsFor(event, { withView: false })} />
          </div>
        </div>
      </ColgateWrapper>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ColgateWrapper className="border border-neutral-200 p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Présentation</h2>
          <p className="mt-3 whitespace-pre-line text-slate-700">{event.description || 'Pas encore de description.'}</p>
          {event.location_url && (
            <a href={event.location_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <Link2 className="size-4" />
              Lien de connexion
            </a>
          )}
        </ColgateWrapper>
        <ColgateWrapper className="border border-neutral-200 p-5">
          <dl className="space-y-4">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-sm font-medium text-slate-900">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </ColgateWrapper>
      </div>

      {(event.status === 'completed' || event.replay_video_asset) && (
        <ColgateWrapper className="mt-6 border border-neutral-200 p-5">
          <ReplayPanel slug={community.slug} event={event} canManage={canManage} />
        </ColgateWrapper>
      )}

      <ColgateWrapper className="mt-6 border border-neutral-200 p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Participants</h2>
        <Attendees slug={community.slug} eventId={event.id} />
      </ColgateWrapper>

      <EventFormModal slug={community.slug} open={editing} event={event} onClose={() => setEditing(false)} />
      {confirmDialog}
    </div>
  );
}

export default EventDetails;
