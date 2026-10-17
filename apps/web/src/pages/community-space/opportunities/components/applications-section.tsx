import { FileText, Link2 } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage, Badge, Button, ColgateWrapper, customToast, EmptyAlert } from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { personName } from '@/pages/shared/person';
import { dateFormat } from '@/pages/shared/row-actions';
import { useGetOpportunityApplicationsQuery, useUpdateOpportunityApplicationStatusMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { OpportunityApplication, OpportunityApplicationStatus } from '@/utils/api/opportunity/opportunity.type';
import { nameInitials } from '@/utils/Utils';
import { applicationStatusLabel, applicationStatusStyle } from '../opportunity-labels';

const STATUSES = Object.keys(applicationStatusLabel) as OpportunityApplicationStatus[];

function ApplicationItem({ application: a, opportunitySlug }: { application: OpportunityApplication; opportunitySlug: string }) {
  const [updateStatus, { isLoading }] = useUpdateOpportunityApplicationStatusMutation();
  const [expanded, setExpanded] = useState(false);
  const name = personName(a.applicant);
  const longLetter = a.cover_letter.length > 220;

  const change = async (status: OpportunityApplicationStatus) => {
    try {
      await updateStatus({ applicationId: a.id, opportunitySlug, status }).unwrap();
      customToast.success({ message: `Candidature de ${name} : ${applicationStatusLabel[status].toLowerCase()}.` });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
      <Avatar className="size-10">
        {a.applicant.avatar_url && <AvatarImage src={a.applicant.avatar_url} alt="" />}
        <AvatarFallback>{nameInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{name}</span>
          <span className="text-sm text-slate-500">@{a.applicant.username}</span>
          <Badge variant="outline" className={applicationStatusStyle[a.status]}>
            {applicationStatusLabel[a.status]}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Reçue le {dateFormat.format(new Date(a.created_at))}</p>
        {a.cover_letter && (
          <div className="mt-2 text-sm text-slate-700">
            <p className="whitespace-pre-line">{expanded || !longLetter ? a.cover_letter : `${a.cover_letter.slice(0, 220)}…`}</p>
            {longLetter && (
              <button type="button" className="mt-1 text-sm font-semibold text-brand hover:underline" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Réduire' : 'Lire la suite'}
              </button>
            )}
          </div>
        )}
        {(a.resume_url || a.portfolio_url) && (
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {a.resume_url && (
              <a href={a.resume_url} target="_blank" rel="noreferrer" aria-label={`CV de ${name}`} className="flex items-center gap-1 font-medium text-brand hover:underline">
                <FileText className="size-3.5" aria-hidden />
                CV
              </a>
            )}
            {a.portfolio_url && (
              <a href={a.portfolio_url} target="_blank" rel="noreferrer" aria-label={`Portfolio de ${name}`} className="flex items-center gap-1 font-medium text-brand hover:underline">
                <Link2 className="size-3.5" aria-hidden />
                Portfolio
              </a>
            )}
          </div>
        )}
      </div>
      <label className="flex shrink-0 flex-col gap-1 text-xs font-medium text-slate-500">
        Statut
        <select
          aria-label={`Statut de la candidature de ${name}`}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 disabled:opacity-60"
          value={a.status}
          disabled={isLoading}
          onChange={(e) => change(e.target.value as OpportunityApplicationStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {applicationStatusLabel[s]}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}

/** Applications of an offer, for its poster (GET opportunities/<slug>/applications/) */
export function ApplicationsSection({ opportunitySlug }: { opportunitySlug: string }) {
  const [filter, setFilter] = useState<OpportunityApplicationStatus | 'all'>('all');
  const { data = [], isLoading, error, refetch } = useGetOpportunityApplicationsQuery(opportunitySlug);
  const list = filter === 'all' ? data : data.filter((a) => a.status === filter);

  return (
    <ColgateWrapper id="candidatures" className="scroll-mt-20 border border-neutral-200 p-4">
      <h2 className="text-lg font-semibold text-slate-900">Candidatures</h2>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrer les candidatures">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          Toutes <span className="tabular-nums opacity-70">{data.length}</span>
        </FilterChip>
        {STATUSES.map((s) => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {applicationStatusLabel[s]} <span className="tabular-nums opacity-70">{data.filter((a) => a.status === s).length}</span>
          </FilterChip>
        ))}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-slate-500">Chargement des candidatures…</p>
      ) : error ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <EmptyAlert text={parseApiError(error).message} />
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Réessayer
          </Button>
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{data.length ? 'Aucune candidature avec ce statut.' : 'Aucune candidature pour le moment.'}</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100" aria-label="Liste des candidatures">
          {list.map((a) => (
            <ApplicationItem key={a.id} application={a} opportunitySlug={opportunitySlug} />
          ))}
        </ul>
      )}
    </ColgateWrapper>
  );
}
