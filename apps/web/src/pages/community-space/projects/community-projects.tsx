import { FolderPlus, RotateCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, ColgateWrapper, EmptyAlert, Pagination, SearchInput, TopTitle } from '@kodinga/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { useGetCommunityProjectsQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { ProjectOrder } from '@/utils/api/project/project.type';
import { useUser } from '@/utils/Utils';
import { useCommunitySpace } from '../community-space-context';
import { ProjectCard } from './components/project-card';
import UseProjectActions from './form/UseProjectActions';
import ProjectFormModal from './modals/project-form-modal';

const ORDERS: { id: ProjectOrder; label: string }[] = [
  { id: 'upvotes', label: 'Les plus votés' },
  { id: 'recent', label: 'Les plus récents' },
  { id: 'views', label: 'Les plus vus' },
];

type Filter = 'all' | 'featured' | 'mine';

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * /c/:slug/projects — projects shared by the members (GET projects/?community=<slug>&order_by=).
 * The api answers every published project at once: the search and the pages are done here.
 */
function CommunityProjects() {
  const { community } = useCommunitySpace();
  const navigate = useNavigate();
  const userId = useUser()?.id;
  const [order, setOrder] = useState<ProjectOrder>('upvotes');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(12);
  const [creating, setCreating] = useState(false);
  const base = `/c/${community.slug}/projects`;
  // Editing needs the full project: the detail page opens the form
  const { actionsFor, confirmDialog } = UseProjectActions({ onEdit: (p) => navigate(`${base}/${p.slug}`, { state: { edit: true } }) });

  const { data, isLoading, isFetching, error, refetch } = useGetCommunityProjectsQuery({ community: community.slug, order_by: order });

  const list = useMemo(() => {
    const needle = normalize(search.trim());
    return (data ?? []).filter(
      (p) =>
        (filter === 'all' || (filter === 'featured' && p.is_featured) || (filter === 'mine' && p.owner.id === userId)) &&
        (!needle || normalize([p.title, p.tagline, p.owner.username, p.owner.first_name, p.owner.last_name, ...p.technologies.map((t) => t.name)].join(' ')).includes(needle)),
    );
  }, [data, filter, search, userId]);
  const rows = list.slice((page - 1) * size, page * size);
  const resetPage = () => setPage(1);

  return (
    <div className="community__projects">
      <div className="flex flex-wrap items-start justify-between gap-4 [&>:last-child]:mb-4">
        <TopTitle title="Projets" paragraph={`Ce que construisent les membres de ${community.name}`} />
        <Button onClick={() => setCreating(true)}>
          <FolderPlus />
          Partager un projet
        </Button>
      </div>

      <ColgateWrapper className="border border-border p-4">
        <SearchInput
          id="space-projects-search"
          size="md"
          className="md:max-w-sm"
          label="Rechercher un projet"
          clearLabel="Effacer la recherche"
          placeholder="Nom, membre, technologie…"
          value={search}
          onValueChange={(value: string) => {
            setSearch(value);
            resetPage();
          }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Trier les projets">
            {ORDERS.map((o) => (
              <FilterChip
                key={o.id}
                active={order === o.id}
                onClick={() => {
                  setOrder(o.id);
                  resetPage();
                }}
              >
                {o.label}
              </FilterChip>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les projets">
            {(
              [
                ['all', 'Tous'],
                ['featured', 'Mis en avant'],
                ['mine', 'Mes projets'],
              ] as const
            ).map(([id, label]) => (
              <FilterChip
                key={id}
                active={filter === id}
                onClick={() => {
                  setFilter(id);
                  resetPage();
                }}
              >
                {label}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mt-4" aria-busy={isFetching}>
          {isLoading ? (
            <ul aria-label="Chargement des projets" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
              ))}
            </ul>
          ) : error && !data ? (
            <div className="flex flex-col items-start gap-3">
              <EmptyAlert text={parseApiError(error).message} />
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCw />
                Réessayer
              </Button>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="font-semibold text-foreground">{data?.length ? 'Aucun projet ne correspond' : 'Aucun projet partagé pour le moment'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Les projets des membres montrent ce que la communauté sait faire.</p>
              {!data?.length && (
                <Button className="mt-5" onClick={() => setCreating(true)}>
                  <FolderPlus />
                  Partager le premier projet
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${isFetching ? 'opacity-60 transition-opacity' : ''}`} aria-label="Projets">
                {rows.map((p) => (
                  <ProjectCard key={p.id} project={p} href={`${base}/${p.slug}`} actions={actionsFor(p)} mine={p.owner.id === userId} />
                ))}
              </ul>
              <Pagination
                totalItems={list.length}
                currentPage={page}
                perPage={size}
                pageSizeOptions={[12, 24, 48]}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setSize(n);
                  resetPage();
                }}
              />
            </>
          )}
        </div>
      </ColgateWrapper>

      <ProjectFormModal communityId={community.id} open={creating} project={null} onClose={() => setCreating(false)} onSaved={(saved) => navigate(`${base}/${saved.slug}`)} />
      {confirmDialog}
    </div>
  );
}

export default CommunityProjects;
