import { ArrowRight, Crown, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage } from '@kodinga-mono-repo/ui';
import { useGetCommunityLeaderboardQuery } from '@/utils/api/community/community.api';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { formatCompact, getName, nameInitials } from '@/utils/Utils';

/**
 * Who is in the community. The full list (GET .../members/) is kept for the team: visitors see the
 * count, the creator and the most active members (public leaderboard).
 */
export function MembersPanel({ community, isTeam }: { community: CommunityDetail; isTeam: boolean }) {
  const { data = [], isLoading } = useGetCommunityLeaderboardQuery({ slug: community.slug, limit: 12 });
  const owner = getName(community.owner) || community.owner.username;
  const n = community.members_count;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Users className="size-5 text-brand" />
          {formatCompact(n)} membre{n > 1 ? 's' : ''}
        </p>
        {isTeam && (
          <Link to={`/c/${community.slug}/members`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-900 hover:underline">
            Gérer les membres <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <Avatar className="size-11">
          <AvatarFallback>{nameInitials(owner)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{owner}</p>
          <p className="text-sm text-slate-500">@{community.owner.username}</p>
        </div>
        <span className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
          <Crown className="size-3.5" /> Créateur
        </span>
      </div>

      <section aria-labelledby="active-members">
        <h3 id="active-members" className="text-sm font-semibold text-slate-900">
          Membres les plus actifs
        </h3>
        {isLoading ? (
          <p className="py-6 text-sm text-slate-500">Chargement…</p>
        ) : data.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">Les membres apparaîtront ici dès leurs premières contributions.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Membres les plus actifs">
            {data.map((e) => (
              <li key={e.user.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <Avatar className="size-9">
                  {e.user.avatar_url && <AvatarImage src={e.user.avatar_url} alt="" />}
                  <AvatarFallback className="text-xs">{nameInitials(e.user.name || e.user.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{e.user.name}</p>
                  <p className="truncate text-xs text-slate-500">{e.rank_title}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!isTeam && <p className="mt-4 text-xs text-slate-500">La liste complète des membres est visible par l’équipe de la communauté.</p>}
      </section>
    </div>
  );
}
