import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ActivityFeed } from './components/activity-feed';
import { CommunityCard } from './components/community-card';
import { CreatorCallout } from './components/creator-callout';
import { DiscoverFilters } from './components/discover-filters';
import { FinalCtaSection } from './components/final-cta-section';
import { HeroSection } from './components/hero-section';
import { LeaderboardCard } from './components/leaderboard-card';
import { TestimonialsSection } from './components/testimonials-section';
import {
  type CategoryId,
  type Community,
  communities,
  type SortId,
  type StackId,
} from '@/data/home.data';

const PAGE_SIZE = 6;

const matchesCategory = (c: Community, category: CategoryId) => {
  if (category === 'all') return true;
  if (category === 'free') return c.access.kind === 'free';
  return c.categories.includes(category);
};

const sorters: Record<SortId, (a: Community, b: Community) => number> = {
  active: (a, b) => b.online - a.online,
  members: (a, b) => b.members - a.members,
  recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

function Home() {
  const [category, setCategory] = useState<CategoryId>('all');
  const [stack, setStack] = useState<StackId | null>(null);
  const [sort, setSort] = useState<SortId>('active');
  const [showAll, setShowAll] = useState(false);

  const results = useMemo(
    () =>
      communities
        .filter((c) => matchesCategory(c, category))
        .filter((c) => !stack || c.stacks.includes(stack))
        .sort(sorters[sort]),
    [category, stack, sort]
  );
  const visible = showAll ? results : results.slice(0, PAGE_SIZE);

  // Changing a filter collapses the list back to the first page
  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setShowAll(false);
    };

  return (
    <div className="bg-white text-slate-900">
      <HeroSection />

      <DiscoverFilters
        category={category}
        onCategoryChange={withReset(setCategory)}
        stack={stack}
        onStackChange={withReset(setStack)}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-8 xl:col-span-9">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
                <span>Communautés recommandées</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">
                  {results.length} RÉSULTATS
                </span>
              </h2>
              <span className="text-xs font-medium text-slate-500">Mises à jour toutes les 60s</span>
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                Aucune communauté ne correspond à ces filtres pour le moment.
              </div>
            )}

            {results.length > visible.length && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs transition-all hover:border-slate-300 hover:text-slate-900"
                >
                  <span>Afficher plus de communautés</span>
                  <ChevronDown className="size-4.5" />
                </button>
              </div>
            )}
          </div>

          <aside id="leaderboard" className="flex flex-col gap-6 lg:col-span-4 xl:col-span-3">
            <LeaderboardCard />
            <CreatorCallout />
            <ActivityFeed />
          </aside>
        </div>
      </div>

      <TestimonialsSection />
      <FinalCtaSection />
    </div>
  );
}

export default Home;
