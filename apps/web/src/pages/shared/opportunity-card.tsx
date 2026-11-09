import { Building2, CheckCircle2, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatSalary, opportunityTypeLabel, workplaceLabel } from '@/pages/community-space/opportunities/opportunity-labels';
import type { OpportunityListItem } from '@/utils/api/opportunity/opportunity.type';

/**
 * One offer of a list (tab of a community, page /opportunities). `from`: slug of the community
 * the reader comes from, for the "Retour" link of the offer page.
 */
export function OpportunityCard({ opportunity: o, from }: { opportunity: OpportunityListItem; from?: string }) {
  const salary = formatSalary(o);
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
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
            <Link to={from ? `/opportunities/${o.slug}?from=${from}` : `/opportunities/${o.slug}`} className="hover:text-blue-900 hover:underline">
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
}
