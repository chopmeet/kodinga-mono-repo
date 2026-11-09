import { Briefcase } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Loader } from '@kodinga/ui';
import { OpportunityCard } from '@/pages/shared/opportunity-card';
import { useGetCommunityOpportunitiesQuery } from '@/utils/api/community/community.api';
import type { OpportunityType } from '@/utils/api/opportunity/opportunity.type';
import type { CommunityPage } from '../form/UseCommunityPage';
import { LockedPanel } from './locked-panel';
import { Pill, SectionHeader } from './section-header';

// Labels: discover.opportunities.types.<id>
const FILTERS = ['all', 'full_time', 'internship', 'freelance', 'bounty'] as const satisfies readonly (OpportunityType | 'all')[];

/** Open offers shared in the community (jobs, internships, missions, bounties) */
export function OpportunitiesTab({ page }: { page: CommunityPage }) {
  const { t } = useTranslation();
  const slug = page.slug;
  const [type, setType] = useState<OpportunityType | 'all'>('all');
  // The api ignores `type`: the filter runs here (the list is not paginated)
  const { data = [], isLoading } = useGetCommunityOpportunitiesQuery({ community: slug }, { skip: !page.canSee });
  const offers = data.filter((o) => o.status === 'open' && (type === 'all' || o.opportunity_type === type));

  const header = (
    <SectionHeader eyebrow={t('community.opportunitiesTab.eyebrow')} title={t('community.opportunitiesTab.title')} aside={<Briefcase className="size-7 text-amber-600" aria-hidden />}>
      {t('community.opportunitiesTab.intro')}
    </SectionHeader>
  );

  if (!page.canSee) {
    return (
      <section>
        {header}
        <LockedPanel page={page}>{t('community.opportunitiesTab.locked')}</LockedPanel>
      </section>
    );
  }

  return (
    <section>
      {header}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('community.opportunitiesTab.type')}>
        {FILTERS.map((f) => (
          <Pill key={f} active={type === f} onClick={() => setType(f)}>
            {t(`discover.opportunities.types.${f}`)}
          </Pill>
        ))}
      </div>
      {isLoading ? (
        <Loader inline size="sm" message={t('community.opportunitiesTab.loading')} />
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Briefcase className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">{t('community.opportunitiesTab.none')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('community.opportunitiesTab.noneText')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label={t('community.opportunitiesTab.title')}>
          {offers.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} from={slug} />
          ))}
        </ul>
      )}
    </section>
  );
}
