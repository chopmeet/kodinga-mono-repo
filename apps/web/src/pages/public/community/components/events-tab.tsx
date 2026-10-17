import { CalendarDays, CalendarX2, Clock, MapPin, Users } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@kodinga-mono-repo/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { eventTypeLabel, formatEventPlace } from '@/pages/community-space/events/event-labels';
import { useGetCommunityEventsQuery } from '@/utils/api/community/community.api';
import type { CommunityEvent } from '@/utils/api/event/event.type';
import { SectionHeader } from './section-header';

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

/** Upcoming events of the community (GET communities/<slug>/events/?upcoming=true, public) */
export function EventsTab({ slug }: { slug: string }) {
  const [count, setCount] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching } = useGetCommunityEventsQuery({ slug, upcoming: true, page: 1, page_size: count });
  const events = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  return (
    <section>
      <SectionHeader eyebrow="Se retrouver" title="Événements" aside={<CalendarDays className="size-7 text-amber-600" aria-hidden />}>
        Ateliers, lives et rencontres à venir dans la communauté.
      </SectionHeader>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement du calendrier…</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <CalendarX2 className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">Aucun événement à venir</p>
          <p className="mt-1 text-sm text-slate-500">Les lives, ateliers et rencontres apparaîtront ici.</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-6" aria-label="Événements à venir">
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
                          {event.is_full && <span className="font-medium text-amber-700">· complet</span>}
                        </span>
                      </p>
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
    </section>
  );
}
