import { ChevronDown, LoaderCircle, RotateCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CommunityCard, CommunityCardSkeleton } from './components/community-card';
import { CreatorCallout } from './components/creator-callout';
import { type DiscoverFilter, DiscoverFilters } from './components/discover-filters';
import { HeroSection } from './components/hero-section';
import { LeaderboardCard } from './components/leaderboard-card';
import type { StackId } from '@/data/home.data';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onSetSearchQuery } from '@/redux/slice/Search.slice';
import { useDiscoverCommunitiesQuery, useGetCommunityCategoriesQuery } from '@/utils/api/community/community.api';
import type { CommunityListQuery } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { useDebounced } from '@/utils/hooks/useDebounced';

// Quick filters the api supports, before the categories
const QUICK_FILTERS: (DiscoverFilter & { params: CommunityListQuery })[] = [
  { id: 'all', label: 'Toutes les communautés', params: {} },
  { id: 'featured', label: 'À la une', emoji: '🔥', params: { is_featured: true } },
  { id: 'free', label: 'Gratuites', params: { pricing: 'free' } },
];

// The hero stacks search by keyword (the api searches name, tagline, description and slug)
const STACK_KEYWORDS: Record<StackId, string> = {
  rust: 'rust',
  'python-ai': 'python',
  'cloud-devops': 'cloud',
  'web3-fintech': 'web3',
  'mobile-flutter': 'flutter',
  systems: 'kernel',
  typescript: 'typescript',
  cybersecurity: 'sécurité',
};

function Home() {
  const dispatch = useAppDispatch();
  // Shared with the header's compact search (see Search.slice)
  const query = useAppSelector((s) => s.search.query);
  const search = useDebounced(query.trim(), 350);
  const [filter, setFilter] = useState('all');
  // The page belongs to one search: a new search or filter starts again from page 1
  const searchKey = `${filter}|${search}`;
  const [paging, setPaging] = useState({ key: searchKey, page: 1 });
  const page = paging.key === searchKey ? paging.page : 1;

  const { data: categories = [] } = useGetCommunityCategoriesQuery();
  const filters = useMemo<DiscoverFilter[]>(
    () => [...QUICK_FILTERS, ...categories.map((c) => ({ id: `category:${c.slug}`, label: c.name }))],
    [categories]
  );
  const params: CommunityListQuery = filter.startsWith('category:')
    ? { category: filter.slice('category:'.length) }
    : (QUICK_FILTERS.find((f) => f.id === filter)?.params ?? {});

  const { data, isLoading, isFetching, error, refetch } = useDiscoverCommunitiesQuery({ ...params, q: search, page });
  const results = data?.results ?? [];
  const total = data?.pagination.count ?? 0;
  const loadingMore = isFetching && page > 1;

  const stack = (Object.keys(STACK_KEYWORDS) as StackId[]).find((id) => STACK_KEYWORDS[id] === query.trim().toLowerCase()) ?? null;

  return (
    <div className="bg-white text-slate-900">
      <HeroSection stack={stack} onStackChange={(id) => dispatch(onSetSearchQuery(id ? STACK_KEYWORDS[id] : ''))} />

      <DiscoverFilters filters={filters} active={filter} onChange={setFilter} />

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-8 xl:col-span-9">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
                <span>Communautés recommandées</span>
                {data && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">
                    {total} RÉSULTAT{total > 1 ? 'S' : ''}
                  </span>
                )}
              </h2>
              {isFetching && !loadingMore && <LoaderCircle className="size-4 animate-spin text-slate-400" aria-label="Mise à jour des résultats" />}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Chargement des communautés">
                <CommunityCardSkeleton />
              </div>
            ) : error && !data ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                <p>{parseApiError(error).message}</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-2 font-semibold text-brand hover:underline"
                >
                  <RotateCw className="size-4" />
                  Réessayer
                </button>
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {results.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                {search
                  ? `Aucune communauté ne correspond à « ${search} ».`
                  : 'Aucune communauté ne correspond à ces filtres pour le moment.'}
              </div>
            )}

            {results.length > 0 && results.length < total && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => setPaging({ key: searchKey, page: page + 1 })}
                  disabled={loadingMore}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs transition-all hover:border-slate-300 hover:text-slate-900 disabled:opacity-70"
                >
                  <span>Afficher plus de communautés</span>
                  {loadingMore ? <LoaderCircle className="size-4.5 animate-spin" /> : <ChevronDown className="size-4.5" />}
                </button>
              </div>
            )}
          </div>

          <aside id="leaderboard" className="flex flex-col gap-6 lg:col-span-4 xl:col-span-3">
            <LeaderboardCard />
            <CreatorCallout />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Home;
