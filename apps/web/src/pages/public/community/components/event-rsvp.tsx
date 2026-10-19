import { CalendarPlus, Check, ExternalLink, Radio, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga-mono-repo/ui';
import { hasLink } from '@/pages/community-space/events/event-labels';
import { useGetCommunityEventQuery } from '@/utils/api/community/community.api';
import type { CommunityEvent } from '@/utils/api/event/event.type';
import type { CommunityPage } from '../form/UseCommunityPage';
import { canRegister, downloadIcs, type EventRsvp } from '../form/UseEventRsvp';

/** The link of an online event: only in the detail, so loaded for the registered participants */
function EventLink({ slug, event }: { slug: string; event: CommunityEvent }) {
  const { data } = useGetCommunityEventQuery({ slug, eventId: event.id });
  if (event.format === 'livekit') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-500" title="Bientôt disponible">
        <Radio className="size-4" /> Salon live Kodinga : bientôt
      </span>
    );
  }
  if (!hasLink(event.format) || !data?.location_url) return null;
  return (
    <Button asChild size="sm" variant={event.status === 'live' ? 'default' : 'outline'}>
      <a href={data.location_url} target="_blank" rel="noreferrer">
        <ExternalLink /> {event.status === 'live' ? 'Rejoindre maintenant' : 'Lien de connexion'}
      </a>
    </Button>
  );
}

/** Register (or say maybe), then: registered mark, calendar file, link, cancel */
export function EventRsvpActions({ event, page, rsvp }: { event: CommunityEvent; page: CommunityPage; rsvp: EventRsvp }) {
  const busy = rsvp.busyId === event.id;
  if (event.status === 'cancelled') return <p className="text-sm font-medium text-amber-700">Événement annulé</p>;
  if (page.membership === 'visitor') {
    return (
      <Button asChild size="sm">
        <Link to={page.loginUrl}>Se connecter pour s’inscrire</Link>
      </Button>
    );
  }
  if (!canRegister(event, page)) return <p className="text-sm text-slate-500">Réservé aux membres de la communauté.</p>;

  const status = event.user_rsvp_status;
  if (status === 'attending') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
          <Check className="size-4" /> Inscrit
        </span>
        <EventLink slug={page.slug} event={event} />
        <Button size="sm" variant="outline" onClick={() => downloadIcs(event, `${window.location.origin}/communities/${page.slug}?tab=events`)}>
          <CalendarPlus /> Ajouter à mon agenda
        </Button>
        <button type="button" disabled={busy} onClick={() => rsvp.cancel(event)} className="text-sm font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50">
          Annuler mon inscription
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {event.is_full ? (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">Complet</span>
      ) : (
        <Button size="sm" isLoading={busy} onClick={() => rsvp.respond(event, 'attending')}>
          Je participe
        </Button>
      )}
      {status === 'maybe' ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800">
            <Star className="size-4" /> Intéressé
          </span>
          <button type="button" disabled={busy} onClick={() => rsvp.cancel(event)} className="text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50">
            Retirer
          </button>
        </>
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => rsvp.respond(event, 'maybe')}>
          <Star /> Intéressé
        </Button>
      )}
    </div>
  );
}
