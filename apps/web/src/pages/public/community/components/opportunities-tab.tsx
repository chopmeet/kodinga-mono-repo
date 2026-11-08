import { Briefcase, Building2, CheckCircle2, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Loader } from '@kodinga/ui';
import { formatSalary, opportunityTypeLabel, workplaceLabel } from '@/pages/community-space/opportunities/opportunity-labels';
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
  const { data = [], isLoading } = useGetCommunityOpportunitiesQuery({ community: slug, type: type === 'all' ? undefined : type }, { skip: !page.canSee });
  const offers = data.filter((o) => o.status === 'open');

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
          {offers.map((o) => {
            const salary = formatSalary(o);
            return (
              <li key={o.id} className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
                <div className="flex gap-4">
                  {o.company_logo_url ? (
                    <img src={o.company_logo_url} alt="" className="size-12 shrink-0 rounded-lg border border-slate-100 object-cover" />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400" aria-hidden>
                      <Building2 className="size-6" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-wide text-blue-900 uppercase">{opportunityTypeLabel[o.opportunity_type] ?? o.opportunity_type}</p>
                    <h3 className="mt-0.5 text-lg text-slate-900">
                      <Link to={`/opportunities/${o.slug}?from=${slug}`} className="hover:text-blue-900 hover:underline">
                        {o.title}
                      </Link>
                    </h3>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span>{o.company_name}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-slate-400" aria-hidden />
                        {[workplaceLabel[o.workplace_type], o.location].filter(Boolean).join(' · ')}
                      </span>
                      {salary && <span className="font-medium text-slate-800">{salary}</span>}
                    </p>
                    {o.technologies.length > 0 && <p className="mt-2 text-xs text-slate-500">{o.technologies.map((t) => t.name).join(' · ')}</p>}
                  </div>
                  {o.has_applied && (
                    <span className="inline-flex h-fit shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="size-3.5" /> Candidature envoyée
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
