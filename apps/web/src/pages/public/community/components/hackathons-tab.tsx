import { Hourglass, Laptop, MapPin, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { useGetCommunityHackathonsQuery } from '@/utils/api/community/community.api';
import type { HackathonFormat, HackathonListItem } from '@/utils/api/hackathon/hackathon.type';
import { Pill, SectionHeader } from './section-header';

const DAY = 86_400_000;
const formatLabel: Record<HackathonFormat, string> = { online: 'En ligne', in_person: 'Présentiel', hybrid: 'Hybride' };
const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' });
const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

type Filter = 'all' | 'online' | 'in_person';

/** "En ligne · Kodinga Live", "Dakar, Sénégal" */
const place = (h: HackathonListItem) =>
  h.format === 'online' ? 'En ligne' : [h.venue_city, h.venue_country].filter(Boolean).join(', ') || formatLabel[h.format];

/** Days left to apply, while the registrations are open */
function deadline(h: HackathonListItem) {
  if (!h.is_registration_open || !h.registration_end) return null;
  const days = Math.ceil((new Date(h.registration_end).getTime() - Date.now()) / DAY);
  return days > 0 ? `Candidatures : J-${days}` : 'Candidatures : dernier jour';
}

/** Hackathons of the community (public; drafts stay with the team) */
export function HackathonsTab({ slug }: { slug: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading } = useGetCommunityHackathonsQuery({ slug, page_size: 50 });
  // Hybrid counts as both online and on site
  const hackathons = (data?.results ?? []).filter(
    (h) => h.status !== 'draft' && (filter === 'all' || h.format === filter || h.format === 'hybrid'),
  );

  return (
    <section>
      <SectionHeader eyebrow="Construire ensemble" title="Hackathons" aside={<Trophy className="size-7 text-amber-600" aria-hidden />}>
        Relevez des défis en équipe, en ligne ou sur place. Vérifiez la date limite avant de candidater.
      </SectionHeader>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Format">
        {(
          [
            ['all', 'Tous'],
            ['online', 'En ligne'],
            ['in_person', 'Présentiel'],
          ] as const
        ).map(([id, label]) => (
          <Pill key={id} active={filter === id} onClick={() => setFilter(id)}>
            {label}
          </Pill>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement des hackathons…</p>
      ) : hackathons.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Trophy className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">Aucun hackathon pour le moment</p>
          <p className="mt-1 text-sm text-slate-500">Les défis de la communauté apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-6" aria-label="Hackathons">
          {hackathons.map((h) => {
            const start = new Date(h.start_time);
            const left = deadline(h);
            return (
              <li key={h.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="relative h-36">
                  {h.cover_image_url ? <img src={h.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
                </div>
                <div className="flex gap-5 p-6">
                  <div className="flex h-20 w-18 shrink-0 flex-col items-center justify-center self-center rounded-xl bg-blue-900 text-white">
                    <span className="text-2xl leading-none font-semibold">{day.format(start)}</span>
                    <span className="mt-2 text-xs tracking-wide uppercase">{month.format(start).replace('.', '')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-blue-900 uppercase">
                      {h.format === 'online' ? <Laptop className="size-3.5" /> : <MapPin className="size-3.5" />}
                      {formatLabel[h.format]}
                    </p>
                    <h3 className="mt-1 text-xl text-slate-900">
                      <Link to={`/communities/${slug}/hackathons/${h.slug}`} className="hover:text-blue-900 hover:underline">
                        {h.title}
                      </Link>
                    </h3>
                    {h.tagline && <p className="mt-1 text-slate-600">{h.tagline}</p>}
                    <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-4 text-slate-400" /> {place(h)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="size-4 text-slate-400" /> {h.participants_count} inscrit{h.participants_count > 1 ? 's' : ''}
                      </span>
                      {h.prizes_count > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Trophy className="size-4 text-slate-400" /> {h.prizes_count} prix
                        </span>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {left && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900">
                          <Hourglass className="size-3.5" /> {left}
                        </span>
                      )}
                      <Link to={`/communities/${slug}/hackathons/${h.slug}`} className="text-sm font-semibold text-blue-900 hover:underline">
                        {h.is_registration_open ? 'Voir et candidater' : 'Voir le hackathon'} →
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
