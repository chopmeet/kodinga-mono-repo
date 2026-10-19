import { customToast } from '@kodinga-mono-repo/ui';
import { useCancelEventRsvpMutation, useRsvpEventMutation } from '@/utils/api/community/community.api';
import type { CommunityEvent, RsvpStatus } from '@/utils/api/event/event.type';
import { parseApiError } from '@/utils/api/errors';
import type { CommunityPage } from './UseCommunityPage';

/**
 * Who can register: members, and anyone signed in for a public event (except in a secret
 * community), as the api checks it
 */
export function canRegister(event: CommunityEvent, page: Pick<CommunityPage, 'membership' | 'community'>) {
  if (page.membership === 'member') return true;
  return event.is_public && page.community?.privacy_type !== 'secret';
}

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);

/** An .ics file of the event, for the calendar of the participant (Google, Outlook, Apple) */
export function eventIcs(event: CommunityEvent, pageUrl: string) {
  const place = [event.venue_name, event.location_address, event.location_city, event.location_country].filter(Boolean).join(', ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kodinga//Evenements//FR',
    'BEGIN:VEVENT',
    `UID:${event.id}@kodinga`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(event.start_time)}`,
    `DTEND:${icsDate(event.end_time)}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(`${event.description ? `${event.description}\n\n` : ''}${pageUrl}`)}`,
    ...(place ? [`LOCATION:${icsText(place)}`] : []),
    `URL:${pageUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(event: CommunityEvent, pageUrl: string) {
  const url = URL.createObjectURL(new Blob([eventIcs(event, pageUrl)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.slug || 'evenement'}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Registers to an event of the community (attending or maybe) or cancels */
function UseEventRsvp(slug: string) {
  const [rsvp, { isLoading: isSaving, originalArgs }] = useRsvpEventMutation();
  const [cancel, { isLoading: isCancelling, originalArgs: cancelArgs }] = useCancelEventRsvpMutation();
  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };
  return {
    /** The event being saved, for its spinner */
    busyId: isSaving ? originalArgs?.eventId : isCancelling ? cancelArgs?.eventId : undefined,
    respond: (event: CommunityEvent, status: RsvpStatus) =>
      run(
        rsvp({ slug, eventId: event.id, status }).unwrap(),
        status === 'attending' ? `Inscription confirmée : « ${event.title} ».` : 'Noté : vous êtes intéressé par cet événement.',
      ),
    cancel: (event: CommunityEvent) => run(cancel({ slug, eventId: event.id }).unwrap(), 'Inscription annulée.'),
  };
}

export type EventRsvp = ReturnType<typeof UseEventRsvp>;

export default UseEventRsvp;
