import { Medal, TrendingUp, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage, cn } from '@kodinga/ui';
import { pointsFormat } from '@/pages/community-space/leaderboard/leaderboard-labels';
import { useGetCommunityLeaderboardQuery } from '@/utils/api/community/community.api';
import { type LeaderboardPeriod, PERIOD_LABEL } from '@/utils/api/gamification/gamification.type';
import { nameInitials, useUser } from '@/utils/Utils';
import { Pill, SectionHeader } from './section-header';

const PERIODS: LeaderboardPeriod[] = ['weekly', 'monthly', 'all_time'];

/** Members ranked by the points earned in the community over the chosen period (public leaderboard) */
export function LeaderboardTab({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');
  const { data = [], isLoading } = useGetCommunityLeaderboardQuery({ slug, limit: 50, period });
  const userId = useUser()?.id;

  return (
    <section>
      <SectionHeader eyebrow={t('community.leaderboard.eyebrow')} title={t('community.leaderboard.title')} aside={<Trophy className="size-7 text-amber-600" aria-hidden />}>
        {t('community.leaderboard.intro')}
      </SectionHeader>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('community.leaderboard.period')}>
        {PERIODS.map((p) => (
          <Pill key={p} active={period === p} onClick={() => setPeriod(p)}>
            {PERIOD_LABEL[p]}
          </Pill>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('community.leaderboard.loading')}</p>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
          <Medal className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-foreground">
            {period === 'all_time' ? t('community.leaderboard.nobody') : t('community.leaderboard.noneOver', { period: PERIOD_LABEL[period].toLowerCase() })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t('community.leaderboard.howTo')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex justify-between border-b border-border bg-brand-subtle/70 px-4 py-4 sm:px-6 text-[11px] font-medium tracking-wide text-soft uppercase">
            <span>{t('community.leaderboard.rankMember')}</span>
            <span>{t('community.leaderboard.points')}</span>
          </div>
          <ol aria-label={t('community.leaderboard.title')} className="divide-y divide-border-soft">
            {data.map((e) => (
              <li key={e.user.id} className={cn('flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5', e.user.id === userId && 'bg-brand-subtle/50')}>
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    e.rank === 1 ? 'bg-amber-50 text-amber-600' : 'bg-brand-subtle text-soft',
                  )}
                >
                  {e.rank === 1 ? <Trophy className="size-3.5" aria-label={t('community.leaderboard.first')} /> : e.rank}
                </span>
                <Avatar className="size-10 sm:size-12">
                  {e.user.avatar_url && <AvatarImage src={e.user.avatar_url} alt="" />}
                  <AvatarFallback className="bg-brand-subtle font-semibold text-brand-strong">{nameInitials(e.user.name || e.user.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {e.user.name}
                    {e.user.id === userId && <span className="ml-2 text-xs font-semibold text-brand">{t('community.leaderboard.you')}</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {t('community.leaderboard.levelTitle', { level: e.level, title: e.rank_title })}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2 font-semibold text-brand-strong tabular-nums sm:text-lg">
                  {t('community.leaderboard.pts', { points: pointsFormat.format(e.points) })}
                  <TrendingUp className="hidden size-4 sm:block" aria-hidden />
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
