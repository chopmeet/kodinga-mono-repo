import { Clock, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@kodinga-mono-repo/ui';
import { type RowAction, RowActions } from '@/pages/shared/row-actions';
import type { CommunityEvent } from '@/utils/api/event/event.type';
import { eventStatusStyle, eventTypeLabel, formatEventPlace, formatEventWhen } from '../event-labels';

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

/** One event of the list: date tile, title, when / where / attendees, status and actions */
export function EventRow({ event, href, actions }: { event: CommunityEvent; href: string; actions: RowAction[] }) {
  const start = new Date(event.start_time);
  const status = eventStatusStyle[event.status];
  const seats = event.max_attendees ? `${event.attendees_count} / ${event.max_attendees}` : String(event.attendees_count);

  return (
    <li className="flex items-start gap-4 py-4">
      <div
        className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 ${event.status === 'cancelled' ? 'border-slate-200 text-slate-400' : 'border-blue-100 bg-blue-50 text-blue-900'}`}
        aria-hidden
      >
        <span className="text-xs font-semibold uppercase">{monthFormat.format(start).replace('.', '')}</span>
        <span className="text-xl leading-tight font-bold">{start.getDate()}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={href} className="truncate font-semibold text-slate-900 hover:text-primary">
            {event.title}
          </Link>
          <Badge variant="outline" className={status.className}>
            {event.status === 'live' && <span className="size-1.5 animate-pulse rounded-full bg-red-600" />}
            {status.label}
          </Badge>
          <Badge variant="outline" className="text-slate-600">
            {eventTypeLabel[event.event_type]}
          </Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-slate-400" aria-hidden />
            {formatEventWhen(event)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-slate-400" aria-hidden />
            {formatEventPlace(event)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-slate-400" aria-hidden />
            {seats} inscrit{event.attendees_count > 1 ? 's' : ''}
            {event.is_full && <span className="font-medium text-amber-700">· complet</span>}
          </span>
        </div>
      </div>

      <RowActions label={`Actions pour ${event.title}`} actions={actions} />
    </li>
  );
}
