import { RotateCw, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Button, ColgateWrapper, EmptyAlert, Pagination, SearchInput, SelectInput, TopTitle } from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { SoonBadge } from '@/pages/shared/row-actions';
import type { PostType } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { postTypeLabel, useUser } from '@/utils/Utils';
import { useCommunitySpace } from '../community-space-context';
import UseSpacePosts, { type PostStateFilter, type PostTypeFilter, type SpacePost } from './form/UseSpacePosts';
import DeletePostModal from './modals/delete-post-modal';
import PostFormModal from './modals/post-form-modal';
import PostsTable from './tables/posts-table';

const stateFilters: { value: PostStateFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'pinned', label: 'Épinglées' },
];

const typeOptions = [
  { value: 'all', label: 'Tous les types' },
  ...(Object.keys(postTypeLabel) as PostType[]).map((type) => ({ value: type, label: postTypeLabel[type] })),
];

const isState = (value: string | null): value is PostStateFilter => stateFilters.some((f) => f.value === value);

/** /c/:slug/posts — moderation of the community feed */
function CommunityPosts() {
  const { community } = useCommunitySpace();
  const [params, setParams] = useSearchParams();
  const stateParam = params.get('filter');
  // ?filter=locked (dashboard link) is not a filter of the api yet: all posts then
  const state: PostStateFilter = isState(stateParam) ? stateParam : 'all';
  const [type, setType] = useState<PostTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [toDelete, setToDelete] = useState<SpacePost | null>(null);
  const [editing, setEditing] = useState<SpacePost | 'new' | null>(null);
  const userId = useUser()?.id;

  const list = UseSpacePosts(community.slug, { search, state, type, page, size });

  return (
    <div className="community__posts">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <TopTitle title="Publications" paragraph={`Modération du fil de ${community.name}`} />
        <Button onClick={() => setEditing('new')}>
          <SquarePen />
          Nouvelle publication
        </Button>
      </div>

      <ColgateWrapper className="border border-neutral-200 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <SearchInput
            id="space-posts-search"
            size="md"
            className="md:max-w-sm"
            label="Rechercher une publication"
            clearLabel="Effacer la recherche"
            placeholder="Titre, contenu…"
            value={search}
            onValueChange={(value: string) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <SelectInput
            name="space-posts-type"
            aria-label="Filtrer par type"
            customClassContainer="mb-0! w-full sm:w-48"
            customClassInput="mb-0!"
            options={typeOptions}
            value={type}
            onChange={(e) => {
              setType(e.target.value as PostTypeFilter);
              setPage(1);
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par état">
          {stateFilters.map((f) => (
            <FilterChip
              key={f.value}
              active={state === f.value}
              onClick={() => {
                setParams(f.value === 'all' ? {} : { filter: f.value }, { replace: true });
                setPage(1);
              }}
            >
              {f.label} {list.counts[f.value] !== undefined && <span className="tabular-nums opacity-70">{list.counts[f.value]}</span>}
            </FilterChip>
          ))}
          <FilterChip active={false} disabled title="Bientôt disponible" onClick={() => undefined}>
            Verrouillées <SoonBadge />
          </FilterChip>
        </div>

        <div className="mt-5" aria-busy={list.isFetching}>
          {list.error ? (
            <div className="flex flex-col items-start gap-3">
              <EmptyAlert text={parseApiError(list.error).message} />
              <Button variant="outline" size="sm" onClick={() => list.refetch()}>
                <RotateCw />
                Réessayer
              </Button>
            </div>
          ) : !list.isLoading && list.posts.length === 0 ? (
            <EmptyAlert text="Aucune publication ne correspond à ces critères." />
          ) : (
            <div className={list.isFetching && !list.isLoading ? 'opacity-60 transition-opacity' : undefined}>
              <PostsTable
                posts={list.posts}
                isLoading={list.isLoading}
                canEdit={(p) => !!userId && p.author_id === userId}
                onEdit={setEditing}
                onTogglePin={list.togglePin}
                onToggleLock={list.toggleLock}
                onDelete={setToDelete}
              />
              {list.total > 0 && (
                <Pagination
                  totalItems={list.total}
                  currentPage={page}
                  perPage={size}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setSize(n);
                    setPage(1);
                  }}
                />
              )}
            </div>
          )}
        </div>
      </ColgateWrapper>

      <PostFormModal slug={community.slug} open={editing !== null} post={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />

      <DeletePostModal<SpacePost>
        post={toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={async (post) => {
          if (await list.remove(post)) setToDelete(null);
        }}
      />
    </div>
  );
}

export default CommunityPosts;
