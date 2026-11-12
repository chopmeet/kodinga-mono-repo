import type { ColumnDef } from '@tanstack/react-table';
import { ArrowBigUp, Eye, RotateCw, Star, StarOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, customToast, DataTable, EmptyAlert } from '@kodinga/ui';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import {
  useDeleteProjectMutation,
  useFeatureProjectMutation,
  useGetCommunityProjectsQuery,
} from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { ProjectListItem } from '@/utils/api/project/project.type';
import { getName } from '@/utils/Utils';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';
import ConfirmActionModal, { type ConfirmAction } from '../modals/confirm-action-modal';

const MAX_TECHS = 3;

/**
 * Projects shown in the community (projects/?community=<slug>). The api lists the published ones
 * only, without pagination; a platform admin may feature or delete any of them
 */
function CommunityProjectsTab() {
  const community = useDetailsCommunity();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const { data: projects = [], isLoading, isFetching, error, refetch } = useGetCommunityProjectsQuery({ community: community.slug, order_by: 'recent' });
  const [featureProject] = useFeatureProjectMutation();
  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  const actionsFor = (p: ProjectListItem): RowAction[] => [
    { label: 'Voir le projet', icon: <Eye />, onSelect: () => navigate(`/projects/${p.slug}`) },
    p.is_featured
      ? {
          label: 'Retirer de la une',
          icon: <StarOff />,
          onSelect: () => run(featureProject({ projectSlug: p.slug, is_featured: false }).unwrap(), `« ${p.title} » n'est plus à la une.`),
        }
      : {
          label: 'Mettre à la une',
          icon: <Star />,
          onSelect: () => run(featureProject({ projectSlug: p.slug, is_featured: true }).unwrap(), `« ${p.title} » est à la une.`),
        },
    {
      label: 'Supprimer',
      icon: <Trash2 />,
      danger: true,
      onSelect: () =>
        setConfirm({
          title: `Supprimer « ${p.title} » ?`,
          description: `Le projet de ${getName(p.owner) || 'ce membre'}, ses votes et ses commentaires seront supprimés définitivement.`,
          confirmLabel: 'Supprimer',
          icon: <Trash2 />,
          run: () => run(deleteProject(p.slug).unwrap(), `« ${p.title} » a été supprimé.`),
        }),
    },
  ];

  const columns: ColumnDef<ProjectListItem>[] = [
    {
      id: 'project',
      header: 'Projet',
      cell: ({ row }) => (
        <div className="max-w-md min-w-64">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {row.original.is_featured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="À la une" />}
            <span className="truncate">{row.original.title}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            par {getName(row.original.owner) || 'Membre'}
            {row.original.tagline && ` · ${row.original.tagline}`}
          </p>
        </div>
      ),
    },
    {
      id: 'techs',
      header: 'Technologies',
      cell: ({ row }) => {
        const techs = row.original.technologies;
        if (techs.length === 0) return <span className="text-faint">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {techs.slice(0, MAX_TECHS).map((t) => (
              <Badge key={t.id} variant="outline" className="text-body">{t.name}</Badge>
            ))}
            {techs.length > MAX_TECHS && <span className="text-xs text-muted-foreground">+{techs.length - MAX_TECHS}</span>}
          </div>
        );
      },
    },
    {
      id: 'engagement',
      header: 'Engagement',
      cell: ({ row }) => (
        <span className="flex items-center gap-3 text-soft tabular-nums">
          <span className="flex items-center gap-1" title="Votes"><ArrowBigUp className="size-4" />{row.original.upvotes_count}</span>
          <span className="flex items-center gap-1" title="Vues"><Eye className="size-3.5" />{row.original.views_count}</span>
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Publié le',
      cell: ({ row }) => <span className="whitespace-nowrap text-soft">{dateFormat.format(new Date(row.original.created_at))}</span>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.title}`} actions={actionsFor(row.original)} />,
    },
  ];

  if (error && projects.length === 0) {
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
  if (!isLoading && projects.length === 0) return <EmptyAlert text="Aucun projet publié dans cette communauté." />;

  return (
    <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined} aria-busy={isFetching}>
      <p className="mb-3 text-sm text-muted-foreground">Projets publiés uniquement : les brouillons et les projets archivés ne sont pas listés.</p>
      <DataTable columns={columns} data={projects} isLoading={isLoading} />
      <ConfirmActionModal action={confirm} isLoading={isDeleting} onCancel={() => setConfirm(null)} />
    </div>
  );
}

export default CommunityProjectsTab;
