import { Trophy } from 'lucide-react';
import { useState } from 'react';

import { HackathonCard } from '@/pages/shared/hackathon-card';
import { useGetCommunityHackathonsQuery } from '@/utils/api/community/community.api';
import { Pill, SectionHeader } from './section-header';
import { useRealtimeRegistrations } from '@/utils/realtime/use-realtime';

type Filter = 'all' | 'online' | 'in_person';

/** Hackathons of the community (public; drafts stay with the team) */
export function HackathonsTab({ slug, communityId }: { slug: string; communityId: string }) {
  const pollingInterval = useRealtimeRegistrations(communityId);
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading } = useGetCommunityHackathonsQuery({ slug, page_size: 50 }, { pollingInterval });
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
          {hackathons.map((h) => (
            <HackathonCard key={h.id} hackathon={h} communitySlug={slug} />
          ))}
        </ul>
      )}
    </section>
  );
}
