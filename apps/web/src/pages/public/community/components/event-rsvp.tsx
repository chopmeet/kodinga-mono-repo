import { CalendarPlus, Check, ExternalLink, Radio, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga/ui';
import { hasLink } from '@/pages/community-space/events/event-labels';
import { useGetCommunityEventQuery } from '@/utils/api/community/community.api';
import type { CommunityEvent } from '@/utils/api/event/event.type';
import type { CommunityPage } from '../form/UseCommunityPage';
import { canRegister, downloadIcs, type EventRsvp } from '../form/UseEventRsvp';

/** The link of an online event: only in the detail, so loaded for the registered participants */
function EventLink({ slug, event }: { slug: string; event: CommunityEvent }) {
  const { t } = useTranslation();
  const { data } = useGetCommunityEventQuery({ slug, eventId: event.id });
  if (event.format === 'livekit') {
    return (
      <Button asChild size="sm" variant={event.status === 'live' ? 'default' : 'outline'}>
        <Link to={`/communities/${slug}/events/${event.id}/live`}>
          <Radio /> {event.status === 'live' ? t('community.rsvp.joinLive') : t('community.rsvp.liveRoom')}
        </Link>
      </Button>
    );
  }
  if (!hasLink(event.format) || !data?.location_url) return null;
  return (
    <Button asChild size="sm" variant={event.status === 'live' ? 'default' : 'outline'}>
      <a href={data.location_url} target="_blank" rel="noreferrer">
        <ExternalLink /> {event.status === 'live' ? t('community.rsvp.joinNow') : t('community.rsvp.connectionLink')}
      </a>
    </Button>
  );
}

/** Register (or say maybe), then: registered mark, calendar file, link, cancel */
export function EventRsvpActions({ event, page, rsvp }: { event: CommunityEvent; page: CommunityPage; rsvp: EventRsvp }) {
  const { t } = useTranslation();
  const busy = rsvp.busyId === event.id;
  if (event.status === 'cancelled') return <p className="text-sm font-medium text-amber-700">{t('community.rsvp.cancelled')}</p>;
  if (event.status === 'live') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" className="bg-red-600 font-semibold text-white shadow-md shadow-red-600/30 hover:bg-red-500">
          <Link to={`/communities/${page.slug}/events/${event.id}/live`}>
            <Radio className="size-4 animate-pulse" /> {t('community.rsvp.joinDirect')}
          </Link>
        </Button>
        {event.user_rsvp_status === 'attending' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <Check className="size-3.5" /> {t('community.rsvp.registered')}
          </span>
        )}
      </div>
    );
  }

  if (page.membership === 'visitor') {
    return (
      <Button asChild size="sm">
        <Link to={page.loginUrl}>{t('community.rsvp.loginToRegister')}</Link>
      </Button>
    );
  }
  if (!canRegister(event, page)) return <p className="text-sm text-muted-foreground">{t('community.rsvp.membersOnly')}</p>;

  const status = event.user_rsvp_status;
  if (status === 'attending') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
          <Check className="size-4" /> {t('community.rsvp.registered')}
        </span>
        <EventLink slug={page.slug} event={event} />
        <Button size="sm" variant="outline" onClick={() => downloadIcs(event, `${window.location.origin}/communities/${page.slug}?tab=events`)}>
          <CalendarPlus /> {t('community.rsvp.addToCalendar')}
        </Button>
        <button type="button" disabled={busy} onClick={() => rsvp.cancel(event)} className="text-sm font-semibold text-muted-foreground hover:text-red-600 disabled:opacity-50">
          {t('community.rsvp.cancel')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {event.is_full ? (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">{t('community.rsvp.full')}</span>
      ) : (
        <Button size="sm" isLoading={busy} onClick={() => rsvp.respond(event, 'attending')}>
          {t('community.rsvp.attend')}
        </Button>
      )}
      {status === 'maybe' ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800">
            <Star className="size-4" /> {t('community.rsvp.interested')}
          </span>
          <button type="button" disabled={busy} onClick={() => rsvp.cancel(event)} className="text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
            {t('community.rsvp.remove')}
          </button>
        </>
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => rsvp.respond(event, 'maybe')}>
          <Star /> {t('community.rsvp.interested')}
        </Button>
      )}
    </div>
  );
}
