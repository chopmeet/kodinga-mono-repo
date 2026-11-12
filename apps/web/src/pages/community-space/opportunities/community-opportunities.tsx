import { BriefcasePlus, RotateCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, ColgateWrapper, EmptyAlert, Pagination, SearchInput, TopTitle } from '@kodinga/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { useGetCommunityOpportunitiesQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { OpportunityListItem, OpportunityType } from '@/utils/api/opportunity/opportunity.type';
import { useUser } from '@/utils/Utils';
import { canPublishOpportunities, useCommunitySpace } from '../community-space-context';
import { OpportunityRow } from './components/opportunity-row';
import UseOpportunityActions from './form/UseOpportunityActions';
import OpportunityFormModal from './modals/opportunity-form-modal';
import { opportunityTypeLabel } from './opportunity-labels';

type Filter = 'all' | 'mine' | 'jobs' | 'freelance' | 'internship' | 'bounty';

const JOBS: OpportunityType[] = ['full_time', 'part_time', 'contract'];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'mine', label: 'Publiées par moi' },
  { id: 'jobs', label: 'Emplois' },
  { id: 'freelance', label: opportunityTypeLabel.freelance },
  { id: 'internship', label: 'Stages' },
  { id: 'bounty', label: 'Bounties' },
];

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * /c/:slug/opportunities — offers and bounties of the community (GET opportunities/?community=<slug>).
 * The api answers every open offer at once (no pagination): filters and pages are done here.
 */
function CommunityOpportunities() {
  const space = useCommunitySpace();
  const { community } = space;
  const canPublish = canPublishOpportunities(space);
  const navigate = useNavigate();
  const userId = useUser()?.id;
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [creating, setCreating] = useState(false);
  const base = `/c/${community.slug}/opportunities`;
  // Editing needs the full offer: the detail page opens the form
  const { isPoster, actionsFor, confirmDialog } = UseOpportunityActions({
    onEdit: (o) => navigate(`${base}/${o.slug}`, { state: { edit: true } }),
  });

  const { data, isLoading, isFetching, error, refetch } = useGetCommunityOpportunitiesQuery({ community: community.slug });

  const matches = useMemo(() => {
    const all = data ?? [];
    const byFilter = (o: OpportunityListItem, f: Filter) =>
      f === 'all' ||
      (f === 'mine' && o.poster.id === userId) ||
      (f === 'jobs' && JOBS.includes(o.opportunity_type)) ||
      o.opportunity_type === f;
    const needle = normalize(search.trim());
    const searched = needle
      ? all.filter((o) => normalize([o.title, o.company_name, o.location, ...o.technologies.map((t) => t.name)].join(' ')).includes(needle))
      : all;
    return {
      list: searched.filter((o) => byFilter(o, filter)),
      counts: Object.fromEntries(FILTERS.map((f) => [f.id, searched.filter((o) => byFilter(o, f.id)).length])) as Record<Filter, number>,
    };
  }, [data, filter, search, userId]);

  const rows = matches.list.slice((page - 1) * size, page * size);

  return (
    <div className="community__opportunities">
      <div className="flex flex-wrap items-start justify-between gap-4 [&>:last-child]:mb-4">
        <TopTitle title="Opportunités" paragraph={`Offres d'emploi, missions et bounties partagées avec ${community.name}`} />
        {canPublish && (
          <Button onClick={() => setCreating(true)}>
            <BriefcasePlus />
            Publier une offre
          </Button>
        )}
      </div>

      <ColgateWrapper className="border border-border p-4">
        <SearchInput
          id="space-opportunities-search"
          size="md"
          className="md:max-w-sm"
          label="Rechercher une offre"
          clearLabel="Effacer la recherche"
          placeholder="Poste, entreprise, technologie…"
          value={search}
          onValueChange={(value: string) => {
            setSearch(value);
            setPage(1);
          }}
        />

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer les offres">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              active={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
            >
              {f.label} {data && <span className="tabular-nums opacity-70">{matches.counts[f.id]}</span>}
            </FilterChip>
          ))}
        </div>

        <div className="mt-4" aria-busy={isFetching}>
          {isLoading ? (
            <ul aria-label="Chargement des offres" className="divide-y divide-border-soft">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex gap-4 py-4">
                  <span className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-4 w-1/2 animate-pulse rounded bg-muted" />
                    <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
                  </span>
                </li>
              ))}
            </ul>
          ) : error && !data ? (
            <div className="flex flex-col items-start gap-3">
              <EmptyAlert text={parseApiError(error).message} />
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCw />
                Réessayer
              </Button>
            </div>
          ) : matches.list.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="font-semibold text-foreground">{data?.length ? 'Aucune offre ne correspond' : 'Aucune offre pour le moment'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Emplois, stages et bounties aident les membres à passer à l'étape suivante.</p>
              {canPublish && !data?.length && (
                <Button className="mt-5" onClick={() => setCreating(true)}>
                  <BriefcasePlus />
                  Publier la première offre
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className={`divide-y divide-border-soft ${isFetching ? 'opacity-60 transition-opacity' : ''}`} aria-label="Offres">
                {rows.map((o) => (
                  <OpportunityRow key={o.id} opportunity={o} href={`${base}/${o.slug}`} actions={actionsFor(o)} mine={isPoster(o)} />
                ))}
              </ul>
              <Pagination
                totalItems={matches.list.length}
                currentPage={page}
                perPage={size}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setSize(n);
                  setPage(1);
                }}
              />
            </>
          )}
        </div>
      </ColgateWrapper>

      <OpportunityFormModal
        communityId={community.id}
        open={creating}
        opportunity={null}
        onClose={() => setCreating(false)}
        onSaved={(saved) => navigate(`${base}/${saved.slug}`)}
      />
      {confirmDialog}
    </div>
  );
}

export default CommunityOpportunities;
