import { useState } from 'react';

import { useGetOpportunitiesQuery } from '@/utils/api/community/community.api';
import type { OpportunityType, WorkplaceType } from '@/utils/api/opportunity/opportunity.type';
import { useDebounced } from '@/utils/hooks/useDebounced';

export const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export type TypeFilter = OpportunityType | 'all';
export type WorkplaceFilter = WorkplaceType | 'all';

/**
 * Page /opportunities: the open offers the viewer may see (GET opportunities/). The api searches,
 * but ignores type and workplace and does not paginate: those two filters and "Afficher plus" run here.
 */
function UsePublicOpportunities() {
  const [search, setSearchState] = useState('');
  const [type, setTypeState] = useState<TypeFilter>('all');
  const [workplace, setWorkplaceState] = useState<WorkplaceFilter>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const query = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);

  const { data = [], isLoading, isFetching, error, refetch } = useGetOpportunitiesQuery({ search: query || undefined });

  const filtered = data.filter(
    (o) => o.status === 'open' && (type === 'all' || o.opportunity_type === type) && (workplace === 'all' || o.workplace_type === workplace),
  );

  // A new filter shows the first ones again
  const reset = () => setVisible(PAGE_SIZE);

  return {
    search,
    setSearch: (value: string) => {
      setSearchState(value);
      reset();
    },
    type,
    setType: (value: TypeFilter) => {
      setTypeState(value);
      reset();
    },
    workplace,
    setWorkplace: (value: WorkplaceFilter) => {
      setWorkplaceState(value);
      reset();
    },
    offers: filtered.slice(0, visible),
    total: filtered.length,
    showMore: () => setVisible((n) => n + PAGE_SIZE),
    isFiltered: !!query || type !== 'all' || workplace !== 'all',
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

export default UsePublicOpportunities;
