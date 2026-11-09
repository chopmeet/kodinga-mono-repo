import type { CommunityEvent, EventFormat, EventStatus, EventType } from '@/utils/api/event/event.type';
import { dateFormat } from '@/utils/format';
import i18n from '@/utils/i18n';
import { translatedLabels, translatedStyles } from '@/utils/translated';

// Texts in locales/*/labels.ts, read in the current language
export const eventTypeLabel = translatedLabels<EventType>('labels.eventType.', ['live_stream', 'webinar', 'workshop', 'qna', 'meetup']);

export const eventFormatLabel = translatedLabels<EventFormat>('labels.eventFormat.', ['livekit', 'external', 'in_person', 'hybrid']);

export const eventStatusStyle = translatedStyles<EventStatus>('labels.eventStatus.', {
  scheduled: 'border-blue-200 bg-blue-50 text-blue-800',
  live: 'border-red-200 bg-red-50 text-red-700',
  completed: 'border-slate-200 bg-slate-50 text-slate-600',
  cancelled: 'border-amber-200 bg-amber-50 text-amber-800',
});

/** Formats that happen at a place, and the ones reached through a link */
export const hasVenue = (format: EventFormat) => format === 'in_person' || format === 'hybrid';
export const hasLink = (format: EventFormat) => format === 'external' || format === 'hybrid';

const dayFormat = { format: (d: Date) => dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d) };
const timeFormat = { format: (d: Date) => dateFormat({ hour: '2-digit', minute: '2-digit' }).format(d) };

/** "jeudi 23 octobre 2026 · 19:00 – 21:00" (the end date too when it is another day) */
export function formatEventWhen(event: Pick<CommunityEvent, 'start_time' | 'end_time'>) {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${dayFormat.format(start)} · ${timeFormat.format(start)} – ${timeFormat.format(end)}`
    : `${dayFormat.format(start)} ${timeFormat.format(start)} → ${dayFormat.format(end)} ${timeFormat.format(end)}`;
}

/** Where it happens, in one line */
export function formatEventPlace(event: CommunityEvent) {
  if (event.format === 'livekit') return i18n.t('labels.eventPlace.kodingaRoom');
  const place = [event.venue_name, event.location_city, event.location_country].filter(Boolean).join(', ');
  if (event.format === 'external') return i18n.t('labels.eventPlace.externalLink');
  if (event.format === 'hybrid') return place ? i18n.t('labels.eventPlace.hybridPlace', { place }) : i18n.t('labels.eventPlace.hybrid');
  return place || i18n.t('labels.eventPlace.inPerson');
}

/** <input type="datetime-local"> value, in the browser time zone */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (value: string) => new Date(value).toISOString();
