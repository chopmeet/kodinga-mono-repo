import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HackathonCard } from '@/pages/shared/hackathon-card';
import { useGetCommunityHackathonsQuery } from '@/utils/api/community/community.api';
import { Pill, SectionHeader } from './section-header';
import { useRealtimeRegistrations } from '@/utils/realtime/use-realtime';

type Filter = 'all' | 'online' | 'in_person';

/** Hackathons of the community (public; drafts stay with the team) */
export function HackathonsTab({ slug, communityId }: { slug: string; communityId: string }) {
  const { t } = useTranslation();
  const pollingInterval = useRealtimeRegistrations(communityId);
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading } = useGetCommunityHackathonsQuery({ slug, page_size: 50 }, { pollingInterval });
  // Hybrid counts as both online and on site
  const hackathons = (data?.results ?? []).filter(
    (h) => h.status !== 'draft' && (filter === 'all' || h.format === filter || h.format === 'hybrid'),
  );

  return (
    <section>
      <SectionHeader eyebrow={t('community.hackathonsTab.eyebrow')} title={t('community.tabs.hackathons')} aside={<Trophy className="size-7 text-amber-600" aria-hidden />}>
        {t('community.hackathonsTab.intro')}
      </SectionHeader>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('community.hackathonsTab.format')}>
        {(
          [
            ['all', t('community.hackathonsTab.all')],
            ['online', t('community.hackathonsTab.online')],
            ['in_person', t('community.hackathonsTab.inPerson')],
          ] as const
        ).map(([id, label]) => (
          <Pill key={id} active={filter === id} onClick={() => setFilter(id)}>
            {label}
          </Pill>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('community.hackathonsTab.loading')}</p>
      ) : hackathons.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
          <Trophy className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-foreground">{t('community.hackathonsTab.none')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('community.hackathonsTab.noneText')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-6" aria-label={t('community.tabs.hackathons')}>
          {hackathons.map((h) => (
            <HackathonCard key={h.id} hackathon={h} communitySlug={slug} />
          ))}
        </ul>
      )}
    </section>
  );
}
