import type { ColumnDef } from '@tanstack/react-table';
import { Lock, LockOpen, MessageCircle, Pin, PinOff, RotateCw, ThumbsUp, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge, customToast, DataTable, EmptyAlert, Pagination } from '@kodinga/ui';
import DeletePostModal from '@/pages/community-space/posts/modals/delete-post-modal';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import {
  useDeletePostMutation,
  useGetCommunityFeedQuery,
  useTogglePostLockMutation,
  useTogglePostPinMutation,
} from '@/utils/api/community/community.api';
import type { CommunityPostItem } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { getName, postTypeLabel as typeLabel } from '@/utils/Utils';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';

type Row = CommunityPostItem & { author_name: string };
// DeletePostModal shows the author by name
type Deletable = Omit<Row, 'author'> & { author: string };

function CommunityPostsTab() {
  const community = useDetailsCommunity();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [toDelete, setToDelete] = useState<Deletable | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useGetCommunityFeedQuery({ slug: community.slug, page, page_size: size });
  const [togglePin] = useTogglePostPinMutation();
  const [toggleLock] = useTogglePostLockMutation();
  const [deletePost] = useDeletePostMutation();

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  const actionsFor = (p: Row): RowAction[] => [
    p.is_pinned
      ? { label: 'Désépingler', icon: <PinOff />, onSelect: () => run(togglePin(p.id).unwrap(), 'Publication désépinglée.') }
      : { label: 'Épingler', icon: <Pin />, onSelect: () => run(togglePin(p.id).unwrap(), 'Publication épinglée.') },
    p.is_locked
      ? { label: 'Rouvrir les commentaires', icon: <LockOpen />, onSelect: () => run(toggleLock(p.id).unwrap(), 'Commentaires rouverts.') }
      : { label: 'Verrouiller les commentaires', icon: <Lock />, onSelect: () => run(toggleLock(p.id).unwrap(), 'Commentaires verrouillés.') },
    { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => setToDelete({ ...p, author: p.author_name }) },
  ];

  const columns: ColumnDef<Row>[] = [
    {
      id: 'post',
      header: 'Publication',
      cell: ({ row }) => (
        <div className="max-w-md min-w-64">
          <p className="flex items-center gap-1.5 font-medium text-slate-900">
            {row.original.is_pinned && <Pin className="size-3.5 shrink-0 text-primary" aria-label="Épinglée" />}
            {row.original.is_locked && <Lock className="size-3.5 shrink-0 text-slate-500" aria-label="Commentaires verrouillés" />}
            <span className="truncate">{row.original.title}</span>
          </p>
          <p className="text-xs text-slate-500">par {row.original.author_name}</p>
        </div>
      ),
    },
    { id: 'type', header: 'Type', cell: ({ row }) => <Badge variant="outline" className="text-slate-700">{typeLabel[row.original.post_type]}</Badge> },
    {
      id: 'engagement',
      header: 'Engagement',
      cell: ({ row }) => (
        <span className="flex items-center gap-3 text-slate-600 tabular-nums">
          <span className="flex items-center gap-1" title="Réactions"><ThumbsUp className="size-3.5" />{row.original.reactions_count}</span>
          <span className="flex items-center gap-1" title="Commentaires"><MessageCircle className="size-3.5" />{row.original.comments_count}</span>
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Publiée le',
      cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{dateFormat.format(new Date(row.original.created_at))}</span>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.title}`} actions={actionsFor(row.original)} />,
    },
  ];

  const posts: Row[] = (data?.results ?? []).map((p) => ({ ...p, author_name: getName(p.author) || 'Membre' }));
  const total = data?.pagination.count ?? 0;

  if (error && !data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <EmptyAlert text={parseApiError(error).message} />
        <button type="button" onClick={() => refetch()} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <RotateCw className="size-4" />
          Réessayer
        </button>
      </div>
    );
  }
  if (!isLoading && posts.length === 0) return <EmptyAlert text="Aucune publication dans cette communauté." />;

  return (
    <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined} aria-busy={isFetching}>
      <DataTable columns={columns} data={posts} isLoading={isLoading} />
      {total > 0 && (
        <Pagination
          totalItems={total}
          currentPage={page}
          perPage={size}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      )}
      <DeletePostModal<Deletable>
        post={toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={async (post) => {
          await run(deletePost(post.id).unwrap(), 'Publication supprimée.');
          setToDelete(null);
        }}
      />
    </div>
  );
}

export default CommunityPostsTab;
