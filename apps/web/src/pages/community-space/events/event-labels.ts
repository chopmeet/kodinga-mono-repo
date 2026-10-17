import type { CommunityEvent, EventFormat, EventStatus, EventType } from '@/utils/api/event/event.type';

export const eventTypeLabel: Record<EventType, string> = {
  live_stream: 'Live',
  webinar: 'Webinaire',
  workshop: 'Atelier',
  qna: 'Session Q&A',
  meetup: 'Meetup',
};

export const eventFormatLabel: Record<EventFormat, string> = {
  livekit: 'Salon live Kodinga',
  external: 'Lien externe (Meet, Zoom…)',
  in_person: 'Présentiel',
  hybrid: 'Hybride',
};

export const eventStatusStyle: Record<EventStatus, { label: string; className: string }> = {
  scheduled: { label: 'Programmé', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  live: { label: 'En direct', className: 'border-red-200 bg-red-50 text-red-700' },
  completed: { label: 'Terminé', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  cancelled: { label: 'Annulé', className: 'border-amber-200 bg-amber-50 text-amber-800' },
};

/** Formats that happen at a place, and the ones reached through a link */
export const hasVenue = (format: EventFormat) => format === 'in_person' || format === 'hybrid';
export const hasLink = (format: EventFormat) => format === 'external' || format === 'hybrid';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

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
  if (event.format === 'livekit') return 'En ligne · salon Kodinga';
  const place = [event.venue_name, event.location_city, event.location_country].filter(Boolean).join(', ');
  if (event.format === 'external') return 'En ligne · lien externe';
  if (event.format === 'hybrid') return place ? `${place} · et en ligne` : 'Hybride';
  return place || 'Présentiel';
}

/** <input type="datetime-local"> value, in the browser time zone */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (value: string) => new Date(value).toISOString();
