import { Clock } from 'lucide-react';

import type { CommunityDetails } from '@/data/community.data';

const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' });
const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const when = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });

const kindClassName = {
  Live: 'bg-rose-50 text-rose-700 border-rose-200',
  Atelier: 'bg-blue-50 text-blue-700 border-blue-200',
  AMA: 'bg-amber-50 text-amber-800 border-amber-200',
} as const;

export function EventsTab({ community }: { community: CommunityDetails }) {
  return (
    <ul className="flex flex-col gap-3">
      {community.events.map((event) => {
        const date = new Date(event.startsAt);
        return (
          <li key={event.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-slate-200 py-1.5">
              <span className="text-[11px] font-semibold text-brand uppercase">{month.format(date)}</span>
              <span className="text-xl leading-none font-bold text-slate-900">{day.format(date)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-slate-900">{event.title}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 first-letter:uppercase">
                <Clock className="size-3.5" />
                <time dateTime={event.startsAt}>{when.format(date)}</time> • {event.durationMin} min
              </p>
            </div>
            <span className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${kindClassName[event.kind]}`}>
              {event.kind}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
