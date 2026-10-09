import type { ColumnDef } from '@tanstack/react-table';
import { Eye, EyeOff, Pencil } from 'lucide-react';

import { Badge, DataTable } from '@kodinga-mono-repo/ui';
import type { AdminCategory } from '@/data/admin-settings.data';
import { type RowAction, RowActions } from '@/pages/shared/row-actions';

type Props = {
  categories: AdminCategory[];
  onEdit: (category: AdminCategory) => void;
  onToggle: (category: AdminCategory) => void;
};

function CategoriesTable({ categories, onEdit, onToggle }: Props) {
  const actionsFor = (c: AdminCategory): RowAction[] => [
    { label: 'Modifier', icon: <Pencil />, onSelect: () => onEdit(c) },
    c.is_active
      ? { label: 'Désactiver', icon: <EyeOff />, danger: true, onSelect: () => onToggle(c) }
      : { label: 'Réactiver', icon: <Eye />, onSelect: () => onToggle(c) },
  ];

  const columns: ColumnDef<AdminCategory>[] = [
    {
      id: 'name',
      header: 'Catégorie',
      cell: ({ row }) => (
        <div className="min-w-48">
          <p className="font-medium text-slate-900">{row.original.name}</p>
          <p className="text-xs text-slate-500">/{row.original.slug}</p>
        </div>
      ),
    },
    { id: 'description', header: 'Description', cell: ({ row }) => <span className="line-clamp-1 max-w-sm text-slate-600">{row.original.description || '—'}</span> },
    {
      id: 'communities',
      header: () => <span className="block text-right">Communautés</span>,
      cell: ({ row }) => <span className="block text-right text-slate-700 tabular-nums">{row.original.communities_count}</span>,
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) =>
        row.original.is_active ? (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Active</Badge>
        ) : (
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Désactivée</Badge>
        ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.name}`} actions={actionsFor(row.original)} />,
    },
  ];

  return <DataTable columns={columns} data={categories} isLoading={false} />;
}

export default CategoriesTable;
