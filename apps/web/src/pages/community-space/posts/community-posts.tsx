import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ColgateWrapper, EmptyAlert, Pagination, SearchInput, SelectInput, TopTitle } from '@kodinga-mono-repo/ui';
import type { AdminPost, PostType } from '@/data/admin-community-details.data';
import { postTypeLabel } from '@/pages/shared/community-labels';
import { FilterChip } from '@/pages/shared/filter-chip';
import { useCommunitySpace } from '../community-space-context';
import UseSpacePosts, { type PostStateFilter, type PostTypeFilter } from './form/UseSpacePosts';
import DeletePostModal from './modals/delete-post-modal';
import PostsTable from './tables/posts-table';

const stateFilters: { value: PostStateFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'pinned', label: 'Épinglées' },
  { value: 'locked', label: 'Verrouillées' },
];

const typeOptions = [
  { value: 'all', label: 'Tous les types' },
  ...(Object.keys(postTypeLabel) as PostType[]).map((type) => ({ value: type, label: postTypeLabel[type] })),
];

const isState = (value: string | null): value is PostStateFilter => stateFilters.some((f) => f.value === value);

function CommunityPosts() {
  const { community } = useCommunitySpace();
  // ?filter=locked: link from the dashboard "À traiter" panel
  const [params, setParams] = useSearchParams();
  const stateParam = params.get('filter');
  const state: PostStateFilter = isState(stateParam) ? stateParam : 'all';
  const [type, setType] = useState<PostTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [toDelete, setToDelete] = useState<AdminPost | null>(null);

  const list = UseSpacePosts(community, { search, state, type });
  const visible = list.filtered.slice((page - 1) * size, page * size);

  return (
    <div className="community__posts">
      <TopTitle title="Publications" paragraph={`Modération du fil de ${community.name}`} />

      <ColgateWrapper className="border border-neutral-200 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <SearchInput
            id="space-posts-search"
            size="md"
            className="md:max-w-sm"
            label="Rechercher une publication"
            clearLabel="Effacer la recherche"
            placeholder="Titre, auteur…"
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
              {f.label} <span className="tabular-nums opacity-70">{list.counts[f.value]}</span>
            </FilterChip>
          ))}
        </div>

        <div className="mt-5">
          {list.filtered.length === 0 ? (
            <EmptyAlert text="Aucune publication ne correspond à ces critères." />
          ) : (
            <>
              <PostsTable posts={visible} onTogglePin={list.togglePin} onToggleLock={list.toggleLock} onDelete={setToDelete} />
              <Pagination
                totalItems={list.filtered.length}
                currentPage={page}
                perPage={size}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setSize(n);
                  setPage(1);
                }}
              />
            </>
          )}
        </div>
      </ColgateWrapper>

      <DeletePostModal
        post={toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={(post) => {
          list.remove(post);
          setToDelete(null);
        }}
      />
    </div>
  );
}

export default CommunityPosts;
