import { Medal, TrendingUp, Trophy } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage, cn } from '@kodinga-mono-repo/ui';
import { SoonBadge } from '@/pages/shared/row-actions';
import { pointsFormat } from '@/pages/community-space/leaderboard/leaderboard-labels';
import { useGetCommunityLeaderboardQuery } from '@/utils/api/community/community.api';
import { nameInitials, useUser } from '@/utils/Utils';
import { Pill, SectionHeader } from './section-header';

/** Members ranked by the points earned in the community (public leaderboard, all time) */
export function LeaderboardTab({ slug }: { slug: string }) {
  const { data = [], isLoading } = useGetCommunityLeaderboardQuery({ slug, limit: 50 });
  const userId = useUser()?.id;

  return (
    <section>
      <SectionHeader eyebrow="Chaque contribution compte" title="Classement" aside={<Trophy className="size-7 text-amber-600" aria-hidden />}>
        Celles et ceux qui font grandir les échanges.
      </SectionHeader>

      {/* The api ranks the community over all time only */}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Période">
        <Pill active={false} disabled title="Bientôt disponible" onClick={() => undefined}>
          7 jours <SoonBadge />
        </Pill>
        <Pill active={false} disabled title="Bientôt disponible" onClick={() => undefined}>
          30 jours <SoonBadge />
        </Pill>
        <Pill active onClick={() => undefined}>
          Depuis le début
        </Pill>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement du classement…</p>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Medal className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">Personne n'a encore marqué de points</p>
          <p className="mt-1 text-sm text-slate-500">Publier, commenter et suivre les formations rapporte des points.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex justify-between border-b border-slate-200 bg-blue-50/70 px-4 py-4 sm:px-6 text-[11px] font-medium tracking-wide text-slate-600 uppercase">
            <span>Rang · Membre</span>
            <span>Points</span>
          </div>
          <ol aria-label="Classement" className="divide-y divide-slate-100">
            {data.map((e) => (
              <li key={e.user.id} className={cn('flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5', e.user.id === userId && 'bg-blue-50/50')}>
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    e.rank === 1 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-slate-600',
                  )}
                >
                  {e.rank === 1 ? <Trophy className="size-3.5" aria-label="1er" /> : e.rank}
                </span>
                <Avatar className="size-10 sm:size-12">
                  {e.user.avatar_url && <AvatarImage src={e.user.avatar_url} alt="" />}
                  <AvatarFallback className="bg-blue-50 font-semibold text-blue-900">{nameInitials(e.user.name || e.user.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {e.user.name}
                    {e.user.id === userId && <span className="ml-2 text-xs font-semibold text-brand">Vous</span>}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    Niveau {e.level} · {e.rank_title}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2 font-semibold text-blue-900 tabular-nums sm:text-lg">
                  {pointsFormat.format(e.points)} pts
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
