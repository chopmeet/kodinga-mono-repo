import type { ColumnDef } from '@tanstack/react-table';
import { Eye, FileText, Lock, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, customToast, DataTable, EmptyAlert } from '@kodinga/ui';
import { formatSalary, isExpired, opportunityTypeLabel, workplaceLabel } from '@/pages/community-space/opportunities/opportunity-labels';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import { useCloseOpportunityMutation, useGetCommunityOpportunitiesQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { OpportunityListItem } from '@/utils/api/opportunity/opportunity.type';
import { getName } from '@/utils/Utils';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';
import ConfirmActionModal, { type ConfirmAction } from '../modals/confirm-action-modal';

/**
 * Offers posted in the community (opportunities/?community=<slug>). The api lists the open ones
 * only, without pagination; a platform admin may close any of them (OpportunityService.close_opportunity)
 */
function CommunityOpportunitiesTab() {
  const community = useDetailsCommunity();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const { data: opportunities = [], isLoading, isFetching, error, refetch } = useGetCommunityOpportunitiesQuery({ community: community.slug });
  const [closeOpportunity, { isLoading: isClosing }] = useCloseOpportunityMutation();

  const close = async (o: OpportunityListItem) => {
    try {
      await closeOpportunity(o.slug).unwrap();
      customToast.success({ message: `« ${o.title} » est clôturée.` });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  const actionsFor = (o: OpportunityListItem): RowAction[] => [
    { label: "Voir l'offre", icon: <Eye />, onSelect: () => navigate(`/opportunities/${o.slug}`) },
    {
      label: 'Clôturer',
      icon: <Lock />,
      danger: true,
      onSelect: () =>
        setConfirm({
          title: `Clôturer « ${o.title} » ?`,
          description: `L'offre n'acceptera plus de candidatures et disparaîtra de la communauté. Ses ${o.applications_count} candidatures sont conservées.`,
          confirmLabel: 'Clôturer',
          icon: <Lock />,
          run: () => close(o),
        }),
    },
  ];

  const columns: ColumnDef<OpportunityListItem>[] = [
    {
      id: 'offer',
      header: 'Offre',
      cell: ({ row }) => (
        <div className="max-w-md min-w-64">
          <p className="truncate font-medium text-foreground">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.company_name} · publiée par {getName(row.original.poster) || 'Membre'}
          </p>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline" className="whitespace-nowrap text-body">{opportunityTypeLabel[row.original.opportunity_type]}</Badge>,
    },
    {
      id: 'where',
      header: 'Lieu',
      cell: ({ row }) => (
        <div className="text-soft">
          <span className="block whitespace-nowrap">{workplaceLabel[row.original.workplace_type]}</span>
          {row.original.location && <span className="text-xs text-muted-foreground">{row.original.location}</span>}
        </div>
      ),
    },
    {
      id: 'salary',
      header: 'Rémunération',
      cell: ({ row }) => <span className="whitespace-nowrap text-soft">{formatSalary(row.original) || '—'}</span>,
    },
    {
      id: 'applications',
      header: 'Candidatures',
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-soft tabular-nums" title={`${row.original.views_count} vues`}>
          <FileText className="size-3.5" />
          {row.original.applications_count}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Publiée le',
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-soft">
          {dateFormat.format(new Date(row.original.created_at))}
          {row.original.expires_at && (
            <span className={`block text-xs ${isExpired(row.original) ? 'text-red-600' : 'text-muted-foreground'}`}>
              {isExpired(row.original) ? 'Expirée le' : "Jusqu'au"} {dateFormat.format(new Date(row.original.expires_at))}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.title}`} actions={actionsFor(row.original)} />,
    },
  ];

  if (error && opportunities.length === 0) {
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
  if (!isLoading && opportunities.length === 0) return <EmptyAlert text="Aucune offre ouverte dans cette communauté." />;

  return (
    <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined} aria-busy={isFetching}>
      <p className="mb-3 text-sm text-muted-foreground">Offres ouvertes uniquement : les brouillons et les offres clôturées ne sont pas listés.</p>
      <DataTable columns={columns} data={opportunities} isLoading={isLoading} />
      <ConfirmActionModal action={confirm} isLoading={isClosing} onCancel={() => setConfirm(null)} />
    </div>
  );
}

export default CommunityOpportunitiesTab;
