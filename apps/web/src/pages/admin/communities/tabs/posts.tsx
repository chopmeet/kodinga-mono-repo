import type { ColumnDef } from '@tanstack/react-table';
import { Lock, LockOpen, MessageCircle, Pin, PinOff, ThumbsUp, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge, customToast, DataTable, EmptyAlert } from '@kodinga-mono-repo/ui';
import { type AdminPost, getCommunityPosts } from '@/data/admin-community-details.data';
import { postTypeLabel as typeLabel } from '@/pages/shared/community-labels';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';

function CommunityPostsTab() {
  const community = useDetailsCommunity();
  const [posts, setPosts] = useState(() => getCommunityPosts(community));

  const update = (post: AdminPost, patch: Partial<AdminPost>, message: string) => {
    setPosts((list) =>
      list
        .map((p) => (p.id === post.id ? { ...p, ...patch } : p))
        .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at))
    );
    customToast.success({ message });
  };

  const remove = (post: AdminPost) => {
    setPosts((list) => list.filter((p) => p.id !== post.id));
    customToast.success({ message: 'Publication supprimée.' });
  };

  const actionsFor = (p: AdminPost): RowAction[] => [
    p.is_pinned
      ? { label: 'Désépingler', icon: <PinOff />, onSelect: () => update(p, { is_pinned: false }, 'Publication désépinglée.') }
      : { label: 'Épingler', icon: <Pin />, onSelect: () => update(p, { is_pinned: true }, 'Publication épinglée.') },
    p.is_locked
      ? { label: 'Rouvrir les commentaires', icon: <LockOpen />, onSelect: () => update(p, { is_locked: false }, 'Commentaires rouverts.') }
      : { label: 'Verrouiller les commentaires', icon: <Lock />, onSelect: () => update(p, { is_locked: true }, 'Commentaires verrouillés.') },
    { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => remove(p) },
  ];

  const columns: ColumnDef<AdminPost>[] = [
    {
      id: 'post',
      header: 'Publication',
      cell: ({ row }) => (
        <div className="min-w-64 max-w-md">
          <p className="flex items-center gap-1.5 font-medium text-slate-900">
            {row.original.is_pinned && <Pin className="size-3.5 shrink-0 text-primary" aria-label="Épinglée" />}
            {row.original.is_locked && <Lock className="size-3.5 shrink-0 text-slate-500" aria-label="Commentaires verrouillés" />}
            <span className="truncate">{row.original.title}</span>
          </p>
          <p className="text-xs text-slate-500">par {row.original.author}</p>
        </div>
      ),
    },
    { id: 'type', header: 'Type', cell: ({ row }) => <Badge variant="outline" className="text-slate-700">{typeLabel[row.original.type]}</Badge> },
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

  if (posts.length === 0) return <EmptyAlert text="Aucune publication dans cette communauté." />;
  return <DataTable columns={columns} data={posts} isLoading={false} />;
}

export default CommunityPostsTab;
