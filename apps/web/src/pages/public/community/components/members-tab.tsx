import { ArrowUpRight, CalendarDays, Info, Sparkles, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, cn, SearchInput } from '@kodinga-mono-repo/ui';
import { SoonBadge } from '@/pages/shared/row-actions';
import { useGetCommunityLeaderboardQuery, useGetCommunityMembersQuery } from '@/utils/api/community/community.api';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { formatCompact, getName, memberRoleLabel, nameInitials } from '@/utils/Utils';
import { MessageButton } from '@/pages/public/messages/components/message-button';
import { Pill, SectionHeader } from './section-header';

type Card = {
  id: string;
  /** User id (the card id is the membership for the team list) */
  userId: string;
  username: string;
  name: string;
  avatar: string;
  badge: string;
  team: boolean;
  level?: number;
  line: string;
};

const since = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const AVATAR_TONES = ['bg-blue-50 text-blue-900', 'bg-blue-900 text-white', 'bg-amber-50 text-amber-700', 'bg-emerald-50 text-emerald-800'];

/**
 * People of the community. The team reads the full list (GET .../members/, moderators and above);
 * the other members see the contributors of the public leaderboard.
 */
function useMemberCards(slug: string, isTeam: boolean) {
  const members = useGetCommunityMembersQuery({ slug, status: 'active', page: 1, page_size: 100 }, { skip: !isTeam });
  const ranking = useGetCommunityLeaderboardQuery({ slug, limit: 100 }, { skip: isTeam });

  const cards = useMemo<Card[]>(() => {
    if (isTeam) {
      return (members.data?.results ?? []).map((m) => ({
        id: m.id,
        userId: m.user.id,
        username: m.user.username,
        name: getName(m.user) || m.user.username,
        avatar: m.user.avatar ?? '',
        badge: m.custom_title || memberRoleLabel[m.role],
        team: m.role !== 'member',
        line: `Membre depuis ${since.format(new Date(m.joined_at))}`,
      }));
    }
    return (ranking.data ?? []).map((e) => ({
      id: e.user.id,
      userId: e.user.id,
      username: e.user.username,
      name: e.user.name,
      avatar: e.user.avatar_url,
      badge: e.rank_title,
      team: false,
      level: e.level,
      line: `${formatCompact(e.points)} points dans la communauté`,
    }));
  }, [isTeam, members.data, ranking.data]);

  return { cards, isLoading: isTeam ? members.isLoading : ranking.isLoading };
}

export function MembersTab({ community, isTeam }: { community: CommunityDetail; isTeam: boolean }) {
  const [filter, setFilter] = useState<'all' | 'team'>('all');
  const [search, setSearch] = useState('');
  const { cards, isLoading } = useMemberCards(community.slug, isTeam);
  const n = community.members_count;  

  const needle = normalize(search.trim());
  const shown = cards.filter((c) => (filter === 'all' || c.team) && (!needle || normalize(`${c.name} ${c.username} ${c.badge}`).includes(needle)));

  return (
    <section>
      {/* Until the api opens the member list to the members: the others see the contributors */}
      <SectionHeader
        eyebrow="Les personnes derrière le code"
        title={isTeam ? 'Membres' : 'Membres actifs'}
        aside={
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="size-4" /> {formatCompact(n)} membre{n > 1 ? 's' : ''}
          </span>
        }
      >
        {isTeam ? undefined : 'Celles et ceux qui ont déjà contribué : publications, réponses, formations…'}
      </SectionHeader>

      {!isTeam && !isLoading && (
        <p className="mb-6 flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-900" aria-hidden />
          <span>
            Vous voyez{' '}
            <strong>
              {cards.length} membre{cards.length > 1 ? 's' : ''} actif{cards.length > 1 ? 's' : ''}
            </strong>{' '}
            sur {formatCompact(n)} au total. La liste complète de la communauté est réservée à son équipe.
          </span>
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les membres">
          <Pill active={filter === 'all'} onClick={() => setFilter('all')}>
            Tous
          </Pill>
          <Pill active={false} disabled title="Bientôt disponible" onClick={() => undefined}>
            En ligne <SoonBadge />
          </Pill>
          {/* Roles are only in the team's list */}
          <Pill active={filter === 'team'} disabled={!isTeam} title={isTeam ? undefined : 'Visible par l’équipe'} onClick={() => setFilter('team')}>
            Équipe
          </Pill>
        </div>
        <SearchInput
          id="community-members-search"
          size="md"
          className="w-full sm:max-w-sm"
          label="Rechercher un membre"
          clearLabel="Effacer la recherche"
          placeholder="Un nom, un pseudo…"
          value={search}
          onValueChange={(value: string) => setSearch(value)}
        />
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement des membres…</p>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Users className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">{cards.length ? 'Aucun membre ne correspond' : isTeam ? 'Les membres apparaîtront ici' : 'Pas encore de membre actif'}</p>
          {!isTeam && !cards.length && <p className="mt-1 text-sm text-slate-500">Dès leurs premières contributions dans la communauté.</p>}
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-label={isTeam ? 'Membres' : 'Membres actifs'}>
          {shown.map((c, i) => (
            <li key={c.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-2">
                <Avatar className="size-14">
                  {c.avatar && <AvatarImage src={c.avatar} alt="" />}
                  <AvatarFallback className={cn('text-lg font-semibold', AVATAR_TONES[i % AVATAR_TONES.length])}>{nameInitials(c.name)}</AvatarFallback>
                </Avatar>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{c.badge}</span>
              </div>
              <p className="mt-5 flex items-center gap-2 text-lg font-medium text-slate-900">
                <span className="truncate">{c.name}</span>
                {c.level !== undefined && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-900" title={`Niveau ${c.level}`}>
                    {c.level}
                  </span>
                )}
              </p>
              <p className="text-sm text-slate-500">@{c.username}</p>
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                {isTeam ? <CalendarDays className="size-4 text-slate-400" /> : <Sparkles className="size-4 text-slate-400" />}
                {c.line}
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <MessageButton userId={c.userId} label="Écrire" size="sm" variant="outline" className="mt-4" />
                <Link to={`/profiles/${c.username}`} className="mt-4 ml-auto inline-flex items-center gap-1.5 text-sm text-slate-800 hover:text-blue-900">
                  Voir le profil <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
