import { Briefcase } from 'lucide-react';
import { useState } from 'react';

import { Loader } from '@kodinga/ui';
import { OpportunityCard } from '@/pages/shared/opportunity-card';
import { useGetCommunityOpportunitiesQuery } from '@/utils/api/community/community.api';
import type { OpportunityType } from '@/utils/api/opportunity/opportunity.type';
import type { CommunityPage } from '../form/UseCommunityPage';
import { LockedPanel } from './locked-panel';
import { Pill, SectionHeader } from './section-header';

const FILTERS: { id: OpportunityType | 'all'; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'full_time', label: 'Emplois' },
  { id: 'internship', label: 'Stages' },
  { id: 'freelance', label: 'Freelance' },
  { id: 'bounty', label: 'Bounties' },
];

/** Open offers shared in the community (jobs, internships, missions, bounties) */
export function OpportunitiesTab({ page }: { page: CommunityPage }) {
  const slug = page.slug;
  const [type, setType] = useState<OpportunityType | 'all'>('all');
  // The api ignores `type`: the filter runs here (the list is not paginated)
  const { data = [], isLoading } = useGetCommunityOpportunitiesQuery({ community: slug }, { skip: !page.canSee });
  const offers = data.filter((o) => o.status === 'open' && (type === 'all' || o.opportunity_type === type));

  const header = (
    <SectionHeader eyebrow="Saisir sa chance" title="Opportunités" aside={<Briefcase className="size-7 text-amber-600" aria-hidden />}>
      Emplois, stages, missions freelance et bounties partagés par la communauté.
    </SectionHeader>
  );

  if (!page.canSee) {
    return (
      <section>
        {header}
        <LockedPanel page={page}>Les offres partagées dans la communauté sont réservées à ses membres.</LockedPanel>
      </section>
    );
  }

  return (
    <section>
      {header}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Type d’offre">
        {FILTERS.map((f) => (
          <Pill key={f.id} active={type === f.id} onClick={() => setType(f.id)}>
            {f.label}
          </Pill>
        ))}
      </div>
      {isLoading ? (
        <Loader inline size="sm" message="Chargement des offres…" />
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Briefcase className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">Aucune offre pour le moment</p>
          <p className="mt-1 text-sm text-slate-500">Les opportunités partagées par la communauté apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Opportunités">
          {offers.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} from={slug} />
          ))}
        </ul>
      )}
    </section>
  );
}
