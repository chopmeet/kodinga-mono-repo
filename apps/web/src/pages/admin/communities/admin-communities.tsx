import { useEffect, useState } from 'react';

import { ColgateWrapper, EmptyAlert, Pagination, TopTitle } from '@kodinga-mono-repo/ui';
import { useDebounced } from '@/utils/hooks/useDebounced';
import CommunitiesToolbar, { ALL, type CommunityFilters } from './components/communities-toolbar';
import UseArchiveCommunity from './form/UseArchiveCommunity';
import UseCommunitiesList from './form/UseCommunitiesList';
import ArchiveCommunityModal from './modals/archive-community-modal';
import CommunitiesTable from './tables/communities-table';

const SEARCH_DEBOUNCE_MS = 400;

function AdminCommunities() {
  const [filters, setFilters] = useState<CommunityFilters>({ search: '', category: ALL, privacy: ALL, pricing: ALL });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const search = useDebounced(filters.search.trim(), SEARCH_DEBOUNCE_MS);

  // Mock data for now (see form/UseCommunitiesList.ts to plug the api)
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const { data, categories, isLoading, isFetching } = UseCommunitiesList(
    {
      q: search,
      category: filters.category === ALL ? undefined : filters.category,
      privacy: filters.privacy === ALL ? undefined : filters.privacy,
      pricing: filters.pricing === ALL ? undefined : filters.pricing,
      page,
      page_size: size,
    },
    archivedIds
  );
  const archiveFlow = UseArchiveCommunity((community) => setArchivedIds((ids) => [...ids, community.id]));

  // Any new filter or search starts again from the first page
  const updateFilters = (patch: Partial<CommunityFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  useEffect(() => setPage(1), [search]);

  const communities = data?.results ?? [];
  const total = data?.pagination.count ?? 0;
  const hasFilters = !!search || filters.category !== ALL || filters.privacy !== ALL || filters.pricing !== ALL;

  return (
    <div className="admin__communities">
      <TopTitle
        title="Communautés"
        paragraph={data ? `${total} communauté${total > 1 ? 's' : ''} dans l'annuaire` : "Toutes les communautés de l'annuaire"}
      />

      <ColgateWrapper className="border border-neutral-200 p-4">
        <CommunitiesToolbar filters={filters} categories={categories} onChange={updateFilters} />

        <div className="mt-4" aria-busy={isFetching}>
          {!isLoading && communities.length === 0 ? (
            <EmptyAlert
              text={hasFilters ? 'Aucune communauté ne correspond à ces filtres.' : 'Aucune communauté pour le moment.'}
            />
          ) : (
            <>
              <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
                <CommunitiesTable communities={communities} isLoading={isLoading} onArchive={archiveFlow.askArchive} />
              </div>
              {total > 0 && (
                <Pagination
                  totalItems={total}
                  currentPage={page}
                  perPage={size}
                  onPageChange={setPage}
                  onPageSizeChange={(next) => {
                    setSize(next);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </div>
      </ColgateWrapper>

      <ArchiveCommunityModal
        community={archiveFlow.target}
        isLoading={archiveFlow.isLoading}
        onCancel={archiveFlow.cancel}
        onConfirm={archiveFlow.archive}
      />
    </div>
  );
}

export default AdminCommunities;
