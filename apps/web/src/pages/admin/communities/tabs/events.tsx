import type { ColumnDef } from '@tanstack/react-table';
import { Ban, RotateCw, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

import { Badge, cn, customToast, DataTable, EmptyAlert, Pagination } from '@kodinga/ui';
import { eventStatusStyle, eventTypeLabel, formatEventPlace } from '@/pages/community-space/events/event-labels';
import { FilterChip } from '@/pages/shared/filter-chip';
import { type RowAction, RowActions } from '@/pages/shared/row-actions';
import {
  useDeleteEventMutation,
  useGetCommunityEventsQuery,
  useUpdateEventStatusMutation,
} from '@/utils/api/community/community.api';
import type { CommunityEvent, EventStatus } from '@/utils/api/event/event.type';
import { parseApiError } from '@/utils/api/errors';
import { dateFormat } from '@/utils/format';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';
import ConfirmActionModal, { type ConfirmAction } from '../modals/confirm-action-modal';

const FILTERS: { id: EventStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'scheduled', label: 'Programmés' },
  { id: 'live', label: 'En direct' },
  { id: 'completed', label: 'Terminés' },
  { id: 'cancelled', label: 'Annulés' },
];

/**
 * Events of the community (communities/<slug>/events/): a platform admin sees them all, members-only
 * ones included, and may cancel or delete them (EventService.check_is_manager)
 */
function CommunityEventsTab() {
  const community = useDetailsCommunity();
  const [filter, setFilter] = useState<EventStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useGetCommunityEventsQuery({
    slug: community.slug,
    status: filter === 'all' ? undefined : filter,
    page,
    page_size: size,
  });
  const [updateStatus, { isLoading: isCancelling }] = useUpdateEventStatusMutation();
  const [deleteEvent, { isLoading: isDeleting }] = useDeleteEventMutation();

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  const actionsFor = (e: CommunityEvent): RowAction[] => {
    const actions: RowAction[] = [];
    if (e.status === 'scheduled') {
      actions.push({
        label: "Annuler l'événement",
        icon: <Ban />,
        danger: true,
        onSelect: () =>
          setConfirm({
            title: `Annuler « ${e.title} » ?`,
            description: `Ses ${e.attendees_count} inscrits verront l'événement comme annulé.`,
            confirmLabel: "Annuler l'événement",
            icon: <Ban />,
            run: () => run(updateStatus({ slug: community.slug, eventId: e.id, status: 'cancelled' }).unwrap(), `« ${e.title} » est annulé.`),
          }),
      });
    }
    actions.push({
      label: 'Supprimer',
      icon: <Trash2 />,
      danger: true,
      onSelect: () =>
        setConfirm({
          title: `Supprimer « ${e.title} » ?`,
          description: "L'événement et ses inscriptions seront supprimés définitivement.",
          confirmLabel: 'Supprimer',
          icon: <Trash2 />,
          run: () => run(deleteEvent({ slug: community.slug, eventId: e.id }).unwrap(), `« ${e.title} » a été supprimé.`),
        }),
    });
    return actions;
  };

  const columns: ColumnDef<CommunityEvent>[] = [
    {
      id: 'event',
      header: 'Événement',
      cell: ({ row }) => (
        <div className="max-w-md min-w-64">
          <p className="truncate font-medium text-foreground">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatEventPlace(row.original)}
            {row.original.host && ` · animé par ${row.original.host.full_name}`}
            {!row.original.is_public && ' · réservé aux membres'}
          </p>
        </div>
      ),
    },
    { id: 'type', header: 'Type', cell: ({ row }) => <Badge variant="outline" className="text-body">{eventTypeLabel[row.original.event_type]}</Badge> },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => <span className="whitespace-nowrap text-soft">{dateFormat({ day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(row.original.start_time))}</span>,
    },
    {
      id: 'attendees',
      header: 'Inscrits',
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-soft tabular-nums">
          <Users className="size-3.5" />
          {row.original.attendees_count}
          {row.original.max_attendees ? ` / ${row.original.max_attendees}` : ''}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const style = eventStatusStyle[row.original.status];
        return <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', style.className)}>{style.label}</span>;
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.title}`} actions={actionsFor(row.original)} />,
    },
  ];

  const events = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setPage(1);
            }}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>
      {error && !data ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyAlert text={parseApiError(error).message} />
          <button type="button" onClick={() => refetch()} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <RotateCw className="size-4" />
            Réessayer
          </button>
        </div>
      ) : !isLoading && events.length === 0 ? (
        <EmptyAlert text={filter === 'all' ? 'Aucun événement dans cette communauté.' : 'Aucun événement avec ce statut.'} />
      ) : (
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined} aria-busy={isFetching}>
          <DataTable columns={columns} data={events} isLoading={isLoading} />
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
        </div>
      )}
      <ConfirmActionModal action={confirm} isLoading={isCancelling || isDeleting} onCancel={() => setConfirm(null)} />
    </div>
  );
}

export default CommunityEventsTab;
