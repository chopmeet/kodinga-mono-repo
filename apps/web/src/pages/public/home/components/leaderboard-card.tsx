import { Trophy, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { cn, Skeleton } from '@kodinga/ui';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { useGetCommunitiesQuery } from '@/utils/api/community/community.api';
import { formatCompact } from '@/utils/Utils';

const TOP = 4;
const POOL = 30;


export function LeaderboardCard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetCommunitiesQuery({ page: 1, page_size: POOL });

  const top = useMemo(
    () =>
      [...(data?.results ?? [])]
        .sort((a, b) => b.members_count - a.members_count || b.posts_count - a.posts_count)
        .slice(0, TOP),
    [data],
  );

  return (
    <section aria-labelledby="pulse-title" className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="pulse-title" className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
            <Trophy className="size-5 text-amber-500" aria-hidden />
            {t('home.leaderboard.title')}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">{t('home.leaderboard.text')}</p>
        </div>
        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
      </div>

      {isLoading ? (
        <ol className="mt-5 divide-y divide-slate-100 border-b border-slate-100" aria-label={t('home.leaderboard.loading')}>
          {Array.from({ length: TOP }, (_, i) => (
            <li key={i} className="flex items-center gap-3 py-4">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </li>
          ))}
        </ol>
      ) : top.length === 0 ? (
        <p className="mt-5 border-y border-slate-100 py-8 text-center text-sm text-slate-500">
          {isError ? t('home.leaderboard.unavailable') : t('home.leaderboard.soon')}
        </p>
      ) : (
        <ol className="mt-5 divide-y divide-slate-100 border-b border-slate-100" aria-label={t('home.leaderboard.label')}>
          {top.map((community, i) => (
            <li key={community.id}>
              <Link to={`/communities/${community.slug}`} className="group flex items-center gap-3 py-4">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {i + 1}
                </span>
                <CommunityAvatar community={community} className="size-9 rounded-lg text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-primary">{community.name}</span>
                  <span className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" aria-hidden />
                      {t('home.card.members', { count: community.members_count, formatted: formatCompact(community.members_count) })}
                    </span>
                    {/* <span className="flex items-center gap-1">
                      <FileText className="size-3" aria-hidden />
                      {formatCompact(community.posts_count)} publication{community.posts_count > 1 ? 's' : ''}
                    </span> */}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-center text-xs text-slate-500">{t('home.leaderboard.footnote')}</p>
    </section>
  );
}
