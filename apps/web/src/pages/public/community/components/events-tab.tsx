import { CalendarX2, Clock, MapPin } from 'lucide-react';

import { Pagination } from '@kodinga-mono-repo/ui';
import { useState } from 'react';
import { formatEventPlace, formatEventWhen, eventTypeLabel } from '@/pages/community-space/events/event-labels';
import { useGetCommunityEventsQuery } from '@/utils/api/community/community.api';

const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' });
const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

/** Upcoming events of the community (GET communities/<slug>/events/?upcoming=true, public) */
export function EventsTab({ slug }: { slug: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetCommunityEventsQuery({ slug, upcoming: true, page, page_size: 10 });
  const events = data?.results ?? [];

  if (isLoading) return <p className="py-12 text-center text-sm text-slate-500">Chargement du calendrier…</p>;
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
        <CalendarX2 className="size-8 text-slate-300" />
        <p className="mt-3 font-semibold text-slate-900">Aucun événement à venir</p>
        <p className="mt-1 text-sm text-slate-500">Les lives, ateliers et rencontres apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3" aria-label="Événements à venir">
        {events.map((event) => {
          const date = new Date(event.start_time);
          return (
            <li key={event.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-slate-200 py-1.5">
                <span className="text-[11px] font-semibold text-brand uppercase">{month.format(date).replace('.', '')}</span>
                <span className="text-xl leading-none font-bold text-slate-900">{day.format(date)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-slate-900">{event.title}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="size-3.5" /> {formatEventWhen(event)}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="size-3.5" /> {formatEventPlace(event)}
                </p>
              </div>
              <span className="shrink-0 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700">
                {eventTypeLabel[event.event_type]}
              </span>
            </li>
          );
        })}
      </ul>
      {(data?.pagination.count ?? 0) > 10 && (
        <Pagination totalItems={data?.pagination.count ?? 0} currentPage={page} perPage={10} onPageChange={setPage} onPageSizeChange={() => undefined} pageSizeOptions={[10]} />
      )}
    </>
  );
}
