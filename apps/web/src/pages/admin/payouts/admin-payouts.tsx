import { CheckCircle2, Clock, DollarSign, RotateCw, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  ColgateWrapper,
  EmptyAlert,
  Input,
  OverviewCardItem,
  SelectInput,
  TopTitle,
} from '@kodinga/ui';
import {
  useApproveAdminPayoutMutation,
  useDisburseAdminPayoutMutation,
  useGetAdminPayoutsQuery,
  useRejectAdminPayoutMutation,
} from '@/utils/api/admin/admin.api';
import type { CommunityPayout } from '@/utils/api/billing/billing.type';
import { parseApiError } from '@/utils/api/errors';
import { useDebounced } from '@/utils/hooks/useDebounced';
import { xof } from '@/utils/Utils';
import ApprovePayoutModal from './modals/approve-payout-modal';
import DisbursePayoutModal from './modals/disburse-payout-modal';
import RejectPayoutModal from './modals/reject-payout-modal';
import AdminPayoutsTable from './tables/admin-payouts-table';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Approuvés' },
  { value: 'processed', label: 'Effectués' },
  { value: 'rejected', label: 'Refusés' },
  { value: 'failed', label: 'Échoués' },
];

export default function AdminPayouts() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounced(searchInput.trim(), 400);

  // Modals state
  const [selectedPayout, setSelectedPayout] = useState<CommunityPayout | null>(null);
  const [modalType, setModalType] = useState<'approve' | 'reject' | 'disburse' | null>(null);

  // Queries & Mutations
  const { data, isLoading, isFetching, error, refetch } = useGetAdminPayoutsQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: debouncedSearch || undefined,
  });

  const [approvePayout, { isLoading: isApproving }] = useApproveAdminPayoutMutation();
  const [rejectPayout, { isLoading: isRejecting }] = useRejectAdminPayoutMutation();
  const [disbursePayout, { isLoading: isDisbursing }] = useDisburseAdminPayoutMutation();

  const payouts = data?.results ?? [];
  const summary = data?.summary;

  const handleApprove = async (payoutId: string, note?: string) => {
    try {
      await approvePayout({ payoutId, admin_note: note }).unwrap();
      toast.success('Demande de reversement approuvée avec succès.');
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleReject = async (payoutId: string, reason: string, note?: string) => {
    try {
      await rejectPayout({ payoutId, reason, admin_note: note }).unwrap();
      toast.success('Demande rejetée. Le solde a été remboursé au créateur.');
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleDisburse = async (payoutId: string, note?: string) => {
    try {
      const res = await disbursePayout({ payoutId, admin_note: note }).unwrap();
      toast.success(`Virement PayDunya réussi ! Réf : ${res.reference || 'Effectué'}`);
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  return (
    <div className="admin__payouts space-y-6">
      <TopTitle
        title="Demandes de reversement"
        paragraph="Supervision, validation et exécution des virements vers les propriétaires de communautés"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <OverviewCardItem
          item={{
            id: 'pending',
            label: 'Demandes en attente',
            value: summary ? xof(Number(summary.pending_amount)) : '0 FCFA',
            secondaryValue: summary ? `${summary.pending_count} demande(s)` : undefined,
            icon: <Clock size={18} />,
            color: '#d97706',
          }}
        />
        <OverviewCardItem
          item={{
            id: 'processed',
            label: 'Total décaissé (créateurs)',
            value: summary ? xof(Number(summary.processed_amount)) : '0 FCFA',
            secondaryValue: summary ? `${summary.processed_count} virement(s) effectué(s)` : undefined,
            icon: <CheckCircle2 size={18} />,
            color: '#16a34a',
          }}
        />
        <OverviewCardItem
          item={{
            id: 'fees',
            label: 'Commissions Kodinga (2%)',
            value: summary ? xof(Number(summary.fees_collected)) : '0 FCFA',
            secondaryValue: 'Sur les reversements',
            icon: <DollarSign size={18} />,
            color: '#2563eb',
          }}
        />
      </div>

      {/* Toolbar & Filters */}
      <ColgateWrapper className="border border-border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Rechercher communauté, créateur, numéro..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                leftIcon={<Search className="size-4 text-muted-foreground" />}
              />
            </div>
            <div className="w-full sm:w-56">
              <SelectInput
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors self-end sm:self-auto"
          >
            <RotateCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>

        {/* Content / Table */}
        <div className="mt-4" aria-busy={isFetching}>
          {error && !data ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <p>{parseApiError(error).message}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
              >
                <RotateCw className="size-4" />
                Réessayer
              </button>
            </div>
          ) : !isLoading && payouts.length === 0 ? (
            <EmptyAlert
              text={
                statusFilter !== 'all' || debouncedSearch
                  ? 'Aucune demande de reversement ne correspond à ces critères.'
                  : 'Aucune demande de reversement pour le moment.'
              }
            />
          ) : (
            <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
              <AdminPayoutsTable
                payouts={payouts}
                isLoading={isLoading}
                onApprove={(p) => {
                  setSelectedPayout(p);
                  setModalType('approve');
                }}
                onReject={(p) => {
                  setSelectedPayout(p);
                  setModalType('reject');
                }}
                onDisburse={(p) => {
                  setSelectedPayout(p);
                  setModalType('disburse');
                }}
              />
            </div>
          )}
        </div>
      </ColgateWrapper>

      {/* Action Modals */}
      <ApprovePayoutModal
        payout={selectedPayout}
        isOpen={modalType === 'approve'}
        isLoading={isApproving}
        onClose={() => {
          setModalType(null);
          setSelectedPayout(null);
        }}
        onConfirm={handleApprove}
      />

      <RejectPayoutModal
        payout={selectedPayout}
        isOpen={modalType === 'reject'}
        isLoading={isRejecting}
        onClose={() => {
          setModalType(null);
          setSelectedPayout(null);
        }}
        onConfirm={handleReject}
      />

      <DisbursePayoutModal
        payout={selectedPayout}
        isOpen={modalType === 'disburse'}
        isLoading={isDisbursing}
        onClose={() => {
          setModalType(null);
          setSelectedPayout(null);
        }}
        onConfirm={handleDisburse}
      />
    </div>
  );
}

