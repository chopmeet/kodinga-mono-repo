import { Banknote, Building2, Clock, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@kodinga/ui';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import type { OpportunityListItem } from '@/utils/api/opportunity/opportunity.type';
import { formatSalary, isExpired, opportunityTypeLabel, workplaceLabel } from '../opportunity-labels';

/** Company logo, or its initial */
export function CompanyLogo({ name, url, size = 'size-12' }: { name: string; url: string; size?: string }) {
  return url ? (
    <img src={url} alt="" className={`${size} shrink-0 rounded-xl border border-border object-contain p-1`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-muted text-lg font-bold text-muted-foreground`} aria-hidden>
      {name.trim().charAt(0).toUpperCase() || <Building2 className="size-5" />}
    </span>
  );
}

/** One offer of the list: logo, title, company / place / pay, applications and actions */
export function OpportunityRow({ opportunity: o, href, actions, mine }: { opportunity: OpportunityListItem; href: string; actions: RowAction[]; mine: boolean }) {
  const salary = formatSalary(o);
  return (
    <li className="flex items-start gap-4 py-4">
      <CompanyLogo name={o.company_name} url={o.company_logo_url} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={href} className="truncate font-semibold text-foreground hover:text-primary">
            {o.title}
          </Link>
          <Badge variant="outline" className={o.opportunity_type === 'bounty' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'text-soft'}>
            {opportunityTypeLabel[o.opportunity_type]}
          </Badge>
          {mine && (
            <Badge variant="outline" className="border-brand-muted bg-brand-subtle text-blue-700">
              Publiée par vous
            </Badge>
          )}
          {isExpired(o) && (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
              Expirée
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5 text-faint" aria-hidden />
            {o.company_name}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-faint" aria-hidden />
            {workplaceLabel[o.workplace_type]}
            {o.location && o.location !== 'Remote' ? ` · ${o.location}` : ''}
          </span>
          {salary && (
            <span className="flex items-center gap-1.5">
              <Banknote className="size-3.5 text-faint" aria-hidden />
              {salary}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-faint" aria-hidden />
            {o.applications_count} candidature{o.applications_count > 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-faint" aria-hidden />
            {dateFormat.format(new Date(o.created_at))}
          </span>
        </div>
        {o.technologies.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Technologies">
            {o.technologies.map((t) => (
              <li key={t.id} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-soft">
                {t.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <RowActions label={`Actions pour ${o.title}`} actions={actions} />
    </li>
  );
}
