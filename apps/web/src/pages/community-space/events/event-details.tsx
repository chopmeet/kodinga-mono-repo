import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ArrowLeft, CalendarPlus, Clock, Eye, EyeOff, Link2, MapPin, Pencil, PlayCircle, UserRound, Users, Video } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge, Button, ColgateWrapper, DataTable, DetailsPageSkeleton, EmptyAlert, Pagination } from '@kodinga-mono-repo/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { dateFormat, RowActions } from '@/pages/shared/row-actions';
import { useGetCommunityEventQuery, useGetEventAttendeesQuery } from '@/utils/api/community/community.api';
import type { EventAttendee, RsvpStatus } from '@/utils/api/event/event.type';
import { ApiBaseUrl } from '@/utils/http';
import { useCommunitySpace } from '../community-space-context';
import { eventFormatLabel, eventStatusStyle, eventTypeLabel, formatEventPlace, formatEventWhen } from './event-labels';
import UseEventActions from './form/UseEventActions';
import EventFormModal from './modals/event-form-modal';

const rsvpLabel: Record<RsvpStatus, { label: string; className: string }> = {
  attending: { label: 'Inscrit', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  maybe: { label: 'Peut-être', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  declined: { label: 'Ne vient pas', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

function Attendees({ slug, eventId }: { slug: string; eventId: string }) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const { data, isLoading } = useGetEventAttendeesQuery({ slug, eventId, page, page_size: size });
  const attendees = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  if (!isLoading && attendees.length === 0) return <EmptyAlert text="Personne n'est encore inscrit." />;
  return (
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
      {total > 0 && (
        <Pagination
          totalItems={total}
          currentPage={page}
          perPage={size}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      )}
    </>
  );
}

/** /c/:slug/events/:eventId — one event, its actions and its attendees */
function EventDetails() {
  const { community } = useCommunitySpace();
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const back = `/c/${community.slug}/events`;
  const { data: event, isLoading, error } = useGetCommunityEventQuery({ slug: community.slug, eventId }, { skip: !eventId });
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
          {event.replay_video_asset && (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
              <PlayCircle className="size-4" />
              Replay disponible
            </p>
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
