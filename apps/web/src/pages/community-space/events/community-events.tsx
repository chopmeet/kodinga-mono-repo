import { CalendarPlus, RotateCw } from 'lucide-react';
import { useState } from 'react';

import { Button, ColgateWrapper, EmptyAlert, Pagination, TopTitle } from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { useGetCommunityEventsQuery } from '@/utils/api/community/community.api';
import type { CommunityEvent, EventsQuery } from '@/utils/api/event/event.type';
import { parseApiError } from '@/utils/api/errors';
import { useCommunitySpace } from '../community-space-context';
import { EventRow } from './components/event-row';
import UseEventActions from './form/UseEventActions';
import EventFormModal from './modals/event-form-modal';

type Filter = 'upcoming' | 'live' | 'completed' | 'cancelled' | 'all';

const FILTERS: { id: Filter; label: string; params: Partial<EventsQuery> }[] = [
  { id: 'upcoming', label: 'À venir', params: { upcoming: true } },
  { id: 'live', label: 'En direct', params: { status: 'live' } },
  { id: 'completed', label: 'Passés', params: { status: 'completed' } },
  { id: 'cancelled', label: 'Annulés', params: { status: 'cancelled' } },
  { id: 'all', label: 'Tous', params: {} },
];

/** /c/:slug/events — the events of the community (GET communities/<slug>/events/) */
function CommunityEvents() {
  const { community } = useCommunitySpace();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [editing, setEditing] = useState<CommunityEvent | 'new' | null>(null);
  const { canManage, actionsFor, confirmDialog } = UseEventActions({ onEdit: setEditing });

  const params = FILTERS.find((f) => f.id === filter)?.params ?? {};
  const { data, isLoading, isFetching, error, refetch } = useGetCommunityEventsQuery({ slug: community.slug, ...params, page, page_size: size });
  const events = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  return (
    <div className="community__events">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <TopTitle title="Événements" paragraph={`Lives, ateliers et rencontres de ${community.name}`} />
        {canManage && (
          <Button onClick={() => setEditing('new')}>
            <CalendarPlus />
            Nouvel événement
          </Button>
        )}
      </div>

      <ColgateWrapper className="border border-neutral-200 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les événements">
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

        <div className="mt-4" aria-busy={isFetching}>
          {isLoading ? (
            <ul aria-label="Chargement des événements" className="divide-y divide-slate-100">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex gap-4 py-4">
                  <span className="h-14 w-14 animate-pulse rounded-xl bg-slate-100" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                    <span className="block h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                  </span>
                </li>
              ))}
            </ul>
          ) : error && !data ? (
            <div className="flex flex-col items-start gap-3">
              <EmptyAlert text={parseApiError(error).message} />
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCw />
                Réessayer
              </Button>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="font-semibold text-slate-900">{filter === 'upcoming' ? 'Aucun événement à venir' : 'Aucun événement ici'}</p>
              <p className="mt-1 text-sm text-slate-500">Les lives et rencontres rassemblent la communauté.</p>
              {canManage && (
                <Button className="mt-5" onClick={() => setEditing('new')}>
                  <CalendarPlus />
                  Programmer un événement
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className={`divide-y divide-slate-100 ${isFetching ? 'opacity-60 transition-opacity' : ''}`} aria-label="Événements">
                {events.map((event) => (
                  <EventRow key={event.id} event={event} href={`/c/${community.slug}/events/${event.id}`} actions={actionsFor(event)} />
                ))}
              </ul>
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
            </>
          )}
        </div>
      </ColgateWrapper>

      <EventFormModal slug={community.slug} open={editing !== null} event={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      {confirmDialog}
    </div>
  );
}

export default CommunityEvents;
