import { ArrowUpRight, Plus, Radio, RotateCw, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Button, ColgateWrapper, TopTitle } from '@kodinga/ui';
import { FormAlert } from '@/pages/auth/components/form-alert';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { FilterChip } from '@/pages/shared/filter-chip';
import { MyInvitations } from '@/pages/shared/my-invitations';
import { isManaged, useGetMyCommunitiesQuery } from '@/utils/api/community/community.api';
import type { CommunityRole } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { formatCompact, memberRoleLabel } from '@/utils/Utils';

type RoleFilter = 'all' | CommunityRole;
type VisibilityFilter = 'all' | 'public' | 'private';

const roleFilters: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'owner', label: 'Propriétaire' },
  { id: 'admin', label: 'Administrateur' },
  { id: 'moderator', label: 'Modérateur' },
  { id: 'member', label: 'Membre' },
];

const visibilityFilters: { id: VisibilityFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'public', label: 'Publique' },
  { id: 'private', label: 'Privée' },
];

/**
 * /dashboard/communities — every community of the user with their role. Owner, admin and moderator
 * open the space (/c/<slug>) or the member page; a plain member opens the public page.
 */
function MyCommunities() {
  const location = useLocation();
  const deniedSlug = (location.state as { deniedSlug?: string } | null)?.deniedSlug;
  const { data: memberships, isLoading, isFetching, error, refetch } = useGetMyCommunitiesQuery();
  const [role, setRole] = useState<RoleFilter>('all');
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');

  const all = useMemo(() => memberships ?? [], [memberships]);
  const shown = useMemo(
    () =>
      all.filter(
        (m) =>
          (role === 'all' || m.role === role) &&
          // A secret community is private too
          (visibility === 'all' || (visibility === 'public') === (m.community.privacy_type === 'public'))
      ),
    [all, role, visibility]
  );

  return (
    <div className="dashboard__communities">
      <div className="flex flex-wrap items-start justify-between gap-4 [&>:last-child]:mb-4">
        <TopTitle title="Mes communautés" paragraph="Votre rôle dans chaque communauté." />
        {all.length > 0 && (
          <Button asChild className="rounded-xl">
            <Link to="/create-community">
              <Plus />
              Créer une communauté
            </Link>
          </Button>
        )}
      </div>

      {deniedSlug && (
        <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Vous n'avez pas accès à la gestion de « {deniedSlug} ».
        </p>
      )}

      <MyInvitations className="mb-4" />

      <ColgateWrapper className="border border-border p-4 md:p-6">
        {isLoading ? (
          <ul className="grid gap-3" aria-busy="true" aria-label="Chargement de vos communautés">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4">
                <span className="size-12 animate-pulse rounded-xl bg-muted" />
                <span className="flex-1 space-y-2">
                  <span className="block h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <span className="block h-3 w-1/4 animate-pulse rounded bg-muted" />
                </span>
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="flex flex-col items-start gap-3">
            <FormAlert>{parseApiError(error).message}</FormAlert>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline disabled:opacity-60"
            >
              <RotateCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
              Réessayer
            </button>
          </div>
        ) : all.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Sparkles className="size-6" />
            </span>
            <p className="mt-4 text-lg font-semibold text-foreground">Vous n'avez encore aucune communauté</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Lancez la vôtre en quelques minutes, ou{' '}
              <Link to="/" className="font-semibold text-brand hover:underline">
                rejoignez-en une
              </Link>
              .
            </p>
            <Button asChild className="mt-6 rounded-xl">
              <Link to="/create-community">
                <Plus />
                Créer ma communauté
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <h2 className="font-semibold text-foreground">
              {shown.length} communauté{shown.length > 1 ? 's' : ''}
            </h2>
            <p className="text-sm text-muted-foreground">Propriétaire, modérateur ou membre : choisissez où aller.</p>

            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par rôle">
              {roleFilters.map((f) => (
                <FilterChip key={f.id} active={role === f.id} onClick={() => setRole(f.id)}>
                  {f.label}
                </FilterChip>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrer par visibilité">
              {visibilityFilters.map((f) => (
                <FilterChip key={f.id} active={visibility === f.id} onClick={() => setVisibility(f.id)}>
                  {f.label}
                </FilterChip>
              ))}
            </div>

            {shown.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">Aucune communauté ne correspond à ces filtres.</p>
            ) : (
              <ul className="mt-5 divide-y divide-border-soft" aria-label="Mes communautés">
                {shown.map((m) => {
                  const { community } = m;
                  return (
                    <li key={community.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
                      {/* Its width comes first: without enough room beside it, the actions go underneath */}
                      <span className="flex min-w-0 flex-[1_1_18rem] items-center gap-4">
                        <CommunityAvatar community={community} className="size-12 shrink-0 rounded-xl font-mono" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 font-semibold text-foreground">
                            <span className="truncate">{community.name}</span>
                            {community.active_live && (
                              <span className="inline-flex shrink-0 animate-pulse items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                                <span className="size-1.5 animate-ping rounded-full bg-card" />
                                Live
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {memberRoleLabel[m.role]} · {community.privacy_type === 'public' ? 'Publique' : 'Privée'} ·{' '}
                            {formatCompact(community.members_count)} membre{community.members_count > 1 ? 's' : ''}
                          </span>
                        </span>
                      </span>
                      <span className="flex max-w-full flex-wrap gap-2">
                        {community.active_live && (
                          <Link
                            to={`/communities/${community.slug}/events/${community.active_live.id}/live`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-red-500"
                            aria-label={`Rejoindre le direct de ${community.name}`}
                          >
                            <Radio className="size-4 animate-pulse" />
                            Rejoindre
                          </Link>
                        )}
                        {isManaged(m) ? (
                          <>
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/c/${community.slug}/dashboard`} aria-label={`Administrer ${community.name}`}>
                                Admin
                              </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/communities/${community.slug}`} aria-label={`Espace membre de ${community.name}`}>
                                Espace membre
                              </Link>
                            </Button>
                          </>
                        ) : (
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/communities/${community.slug}`} aria-label={`Ouvrir ${community.name}`}>
                              Ouvrir
                              <ArrowUpRight />
                            </Link>
                          </Button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </ColgateWrapper>
    </div>
  );
}

export default MyCommunities;
