import type { ColumnDef } from '@tanstack/react-table';
import { Lock, LockOpen, MessageCircle, Pin, PinOff, ThumbsUp, Trash2 } from 'lucide-react';

import { Badge, DataTable } from '@kodinga-mono-repo/ui';
import type { AdminPost } from '@/data/admin-community-details.data';
import { postTypeLabel } from '@/pages/shared/community-labels';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';

type Props = {
  posts: AdminPost[];
  onTogglePin: (p: AdminPost) => void;
  onToggleLock: (p: AdminPost) => void;
  onDelete: (p: AdminPost) => void;
};

function PostsTable({ posts, onTogglePin, onToggleLock, onDelete }: Props) {
  const actionsFor = (p: AdminPost): RowAction[] => [
    p.is_pinned
      ? { label: 'Désépingler', icon: <PinOff />, onSelect: () => onTogglePin(p) }
      : { label: 'Épingler', icon: <Pin />, onSelect: () => onTogglePin(p) },
    p.is_locked
      ? { label: 'Rouvrir les commentaires', icon: <LockOpen />, onSelect: () => onToggleLock(p) }
      : { label: 'Verrouiller les commentaires', icon: <Lock />, onSelect: () => onToggleLock(p) },
    { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => onDelete(p) },
  ];

  const columns: ColumnDef<AdminPost>[] = [
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
          <p className="text-xs text-slate-500">par {row.original.author}</p>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline" className="text-slate-700">{postTypeLabel[row.original.type]}</Badge>,
    },
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
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RowActions label={`Actions pour ${row.original.title}`} actions={actionsFor(row.original)} />
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} data={posts} isLoading={false} />;
}

export default PostsTable;
