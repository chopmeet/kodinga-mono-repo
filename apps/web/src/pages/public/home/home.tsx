import { ChevronDown, LoaderCircle, RotateCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CommunityCard, CommunityCardSkeleton } from './components/community-card';
import { CreatorCallout } from './components/creator-callout';
import { type AccessFilter, type DiscoverChip, DiscoverFilters, type PrivacyFilter } from './components/discover-filters';
import { HeroSection } from './components/hero-section';
import { LeaderboardCard } from './components/leaderboard-card';
import type { StackId } from '@/data/home.data';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onSetSearchQuery } from '@/redux/slice/Search.slice';
import { useDiscoverCommunitiesQuery, useGetCommunityCategoriesQuery } from '@/utils/api/community/community.api';
import type { CommunityListQuery } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { useDebounced } from '@/utils/hooks/useDebounced';


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
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  // Shared with the header's compact search (see Search.slice)
  const query = useAppSelector((s) => s.search.query);
  const search = useDebounced(query.trim(), 350);
  const [chip, setChip] = useState('all');
  const [access, setAccess] = useState<AccessFilter>('all');
  const [privacy, setPrivacy] = useState<PrivacyFilter>('all');
  // The page belongs to one search: a new search or filter starts again from page 1
  const searchKey = `${chip}|${access}|${privacy}|${search}`;
  const [paging, setPaging] = useState({ key: searchKey, page: 1 });
  const page = paging.key === searchKey ? paging.page : 1;

  const { data: categories = [] } = useGetCommunityCategoriesQuery();
  // Exclusive pills of the strip: these two, then the api categories
  const quickChips: DiscoverChip[] = [
    { id: 'all', label: t('home.filters.all') },
    { id: 'featured', label: t('home.filters.featured'), icon: TrendingUp },
  ];
  const chips: DiscoverChip[] = [...quickChips, ...categories.map((c) => ({ id: `category:${c.slug}`, label: c.name }))];
  const params: CommunityListQuery = {
    ...(chip === 'featured' ? { is_featured: true } : {}),
    ...(chip.startsWith('category:') ? { category: chip.slice('category:'.length) } : {}),
    ...(access !== 'all' ? { pricing: access } : {}),
    ...(privacy !== 'all' ? { privacy } : {}),
  };

  const { data, isLoading, isFetching, error, refetch } = useDiscoverCommunitiesQuery({ ...params, q: search, page });
  const results = data?.results ?? [];
  const total = data?.pagination.count ?? 0;
  const loadingMore = isFetching && page > 1;

  const stack = (Object.keys(STACK_KEYWORDS) as StackId[]).find((id) => STACK_KEYWORDS[id] === query.trim().toLowerCase()) ?? null;

  return (
    <div className="bg-slate-50 text-slate-900">
      <HeroSection stack={stack} onStackChange={(id) => dispatch(onSetSearchQuery(id ? STACK_KEYWORDS[id] : ''))} />

      <DiscoverFilters
        chips={chips}
        active={chip}
        onChange={setChip}
        access={access}
        onAccessChange={setAccess}
        privacy={privacy}
        onPrivacyChange={setPrivacy}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-9">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
                <span>{t('home.list.title')}</span>
                {data && (
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium tracking-wide text-slate-500">
                    {t('home.list.results', { count: total })}
                  </span>
                )}
              </h2>
              {isFetching && !loadingMore && <LoaderCircle className="size-4 animate-spin text-slate-400" aria-label={t('home.list.updating')} />}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2" aria-busy="true" aria-label={t('home.list.loading')}>
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
                  {t('common.actions.retry')}
                </button>
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {results.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                {search ? t('home.list.noMatch', { search }) : t('home.list.noMatchFilters')}
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
                  <span>{t('home.list.showMore')}</span>
                  {loadingMore ? <LoaderCircle className="size-4.5 animate-spin" /> : <ChevronDown className="size-4.5" />}
                </button>
              </div>
            )}

            <p className="flex items-center gap-2 text-sm text-slate-500">
              <ShieldCheck className="size-4.5" aria-hidden />
              {t('home.list.footnote')}
            </p>
          </div>

          <aside id="leaderboard" className="flex flex-col gap-6 lg:col-span-3 lg:sticky lg:top-40">
            <LeaderboardCard />
            <CreatorCallout />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Home;
