import { ArrowUpRight, CalendarDays, Info, RotateCw, Sparkles, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, Button, cn, SearchInput } from '@kodinga/ui';
import { useGetCommunityLeaderboardQuery, useGetCommunityMembersQuery } from '@/utils/api/community/community.api';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { useDebounced } from '@/utils/hooks/useDebounced';
import { formatCompact, getName, memberRoleLabel, nameInitials } from '@/utils/Utils';
import { MessageButton } from '@/pages/public/messages/components/message-button';
import { PeerMatches } from './peer-matches';
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
  online?: boolean;
};

const since = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const AVATAR_TONES = ['bg-blue-50 text-blue-900', 'bg-blue-900 text-white', 'bg-amber-50 text-amber-700', 'bg-emerald-50 text-emerald-800'];

/** Choices of the list, by the api (GET .../members/?ordering=) */
const ORDERINGS = [
  { value: 'reputation', label: 'Les plus actifs' },
  { value: '-joined_at', label: 'Les plus récents' },
  { value: 'username', label: 'Par pseudo' },
] as const;
type Ordering = (typeof ORDERINGS)[number]['value'];

const PAGE_SIZE = 60;

/**
 * People of the community. Its active members read the directory (GET .../members/: searched and
 * sorted by the api); visitors see the contributors of the public leaderboard.
 */
function useMemberCards(slug: string, canList: boolean, search: string, ordering: Ordering, size: number, online: boolean) {
  const members = useGetCommunityMembersQuery(
    { slug, status: 'active', search: search || undefined, online: online || undefined, ordering, page: 1, page_size: size },
    { skip: !canList },
  );
  const ranking = useGetCommunityLeaderboardQuery({ slug, limit: 100 }, { skip: canList });

  const cards = useMemo<Card[]>(() => {
    if (canList) {
      return (members.data?.results ?? []).map((m) => ({
        id: m.id,
        userId: m.user.id,
        username: m.user.username,
        name: getName(m.user) || m.user.username,
        avatar: m.user.avatar_url ?? m.user.avatar ?? '',
        badge: m.custom_title || memberRoleLabel[m.role],
        team: m.role !== 'member',
        line: `Membre depuis ${since.format(new Date(m.joined_at))}`,
        online: m.is_online,
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
  }, [canList, members.data, ranking.data]);

  const source = canList ? members : ranking;
  return {
    cards,
    total: members.data?.pagination.count ?? cards.length,
    isLoading: source.isLoading,
    isFetching: members.isFetching,
    // Failed without anything to show (a failed "Afficher plus" keeps the cards already there)
    failed: !!source.error && cards.length === 0,
    isRetrying: source.isFetching,
    retry: () => void source.refetch(),
  };
}

export function MembersTab({ community, isTeam }: { community: CommunityDetail; isTeam: boolean }) {
  const [filter, setFilter] = useState<'all' | 'online' | 'team'>('all');
  const [search, setSearch] = useState('');
  const [ordering, setOrdering] = useState<Ordering>('reputation');
  const [size, setSize] = useState(PAGE_SIZE);
  const membership = community.user_membership;
  const canList = isTeam || (!!membership?.is_member && membership.status === 'active');
  const query = useDebounced(search.trim(), 300);
  const { cards, total, isLoading, isFetching, failed, isRetrying, retry } = useMemberCards(community.slug, canList, query, ordering, size, filter === 'online');
  const n = community.members_count;

  const needle = normalize(search.trim());
  // The directory is searched by the api, the leaderboard here
  const shown = cards.filter((c) => (filter !== 'team' || c.team) && (canList || !needle || normalize(`${c.name} ${c.username} ${c.badge}`).includes(needle)));

  return (
    <section>
      {/* Visitors: the contributors (the directory is for the members) */}
      <SectionHeader
        eyebrow="Les personnes derrière le code"
        title={canList ? 'Membres' : 'Membres actifs'}
        aside={
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="size-4" /> {formatCompact(n)} membre{n > 1 ? 's' : ''}
          </span>
        }
      >
        {canList ? undefined : 'Celles et ceux qui ont déjà contribué : publications, réponses, formations…'}
      </SectionHeader>

      {!canList && !isLoading && (
        <p className="mb-6 flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-900" aria-hidden />
          <span>
            Vous voyez{' '}
            <strong>
              {cards.length} membre{cards.length > 1 ? 's' : ''} actif{cards.length > 1 ? 's' : ''}
            </strong>{' '}
            sur {formatCompact(n)} au total. La liste complète est réservée aux membres de la communauté.
          </span>
        </p>
      )}

      {!!membership?.is_member && membership.status === 'active' && <PeerMatches slug={community.slug} />}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les membres">
          <Pill active={filter === 'all'} onClick={() => setFilter('all')}>
            Tous
          </Pill>
          {/* Who is online is only in the directory, filtered by the api */}
          <Pill
            active={filter === 'online'}
            disabled={!canList}
            title={canList ? undefined : 'Visible par les membres'}
            onClick={() => {
              setFilter('online');
              setSize(PAGE_SIZE);
            }}
          >
            En ligne
          </Pill>
          {/* Roles are only in the directory */}
          <Pill active={filter === 'team'} disabled={!canList} title={canList ? undefined : 'Visible par les membres'} onClick={() => setFilter('team')}>
            Équipe
          </Pill>
        </div>
        {canList && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="sr-only">Trier les membres</span>
            <select
              value={ordering}
              onChange={(e) => {
                setOrdering(e.target.value as Ordering);
                setSize(PAGE_SIZE);
              }}
              className="h-10 rounded-lg border border-slate-200 bg-white px-2 font-medium text-slate-700"
            >
              {ORDERINGS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <SearchInput
          id="community-members-search"
          size="md"
          className="w-full sm:max-w-sm"
          label="Rechercher un membre"
          clearLabel="Effacer la recherche"
          placeholder="Un nom, un pseudo…"
          value={search}
          onValueChange={(value: string) => {
            setSearch(value);
            setSize(PAGE_SIZE);
          }}
        />
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement des membres…</p>
      ) : failed ? (
        <div role="alert" className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Users className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">Impossible de charger les membres pour le moment</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={retry} isLoading={isRetrying}>
            <RotateCw /> Réessayer
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <Users className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">{cards.length || query ? 'Aucun membre ne correspond' : canList ? 'Les membres apparaîtront ici' : 'Pas encore de membre actif'}</p>
          {!canList && !cards.length && <p className="mt-1 text-sm text-slate-500">Dès leurs premières contributions dans la communauté.</p>}
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-label={canList ? 'Membres' : 'Membres actifs'}>
          {shown.map((c, i) => (
            <li key={c.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-2">
                <Avatar className="relative size-14 overflow-visible">
                  {c.online && <span className="absolute right-0 bottom-0 z-10 size-3.5 rounded-full border-2 border-white bg-emerald-500" title="En ligne" />}
                  {c.avatar && <AvatarImage src={c.avatar} alt="" className="rounded-full" />}
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
              <p className="text-sm text-slate-500">
                @{c.username}
                {c.online && <span className="ml-2 font-medium text-emerald-700">· En ligne</span>}
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                {canList ? <CalendarDays className="size-4 text-slate-400" /> : <Sparkles className="size-4 text-slate-400" />}
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

      {canList && cards.length < total && (
        <Button variant="outline" className="mx-auto mt-6 flex" isLoading={isFetching} onClick={() => setSize((v) => v + PAGE_SIZE)}>
          Afficher plus
        </Button>
      )}
    </section>
  );
}
