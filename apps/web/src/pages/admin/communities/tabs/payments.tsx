import { HandCoins, Landmark, Users, Wallet } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { type CardType, OverviewCardItem } from '@kodinga/ui';
import RevenueChart from '@/pages/shared/billing/revenue-chart';
import SubscribersTable from '@/pages/shared/billing/tables/subscribers-table';
import TransactionsTable from '@/pages/shared/billing/tables/transactions-table';
import QueryState from '@/pages/shared/query-state';
import {
  useApproveAdminPayoutMutation,
  useDisburseAdminPayoutMutation,
  useRejectAdminPayoutMutation,
} from '@/utils/api/admin/admin.api';
import {
  useGetCommunityPayoutsQuery,
  useGetCommunityRevenueQuery,
  useGetCommunitySubscribersQuery,
  useGetCommunityTransactionsQuery,
} from '@/utils/api/community/community.api';
import type { CommunityPayout, CommunityRevenue } from '@/utils/api/billing/billing.type';
import { parseApiError } from '@/utils/api/errors';
import { xof } from '@/utils/Utils';
import ApprovePayoutModal from '@/pages/admin/payouts/modals/approve-payout-modal';
import DisbursePayoutModal from '@/pages/admin/payouts/modals/disburse-payout-modal';
import RejectPayoutModal from '@/pages/admin/payouts/modals/reject-payout-modal';
import AdminPayoutsTable from '@/pages/admin/payouts/tables/admin-payouts-table';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const revenueCards = (r: CommunityRevenue): CardType[] => [
  { id: 'gross', label: 'Payé par les membres', value: xof(Number(r.total_gross)), icon: <Wallet size={18} />, color: '#1D4ED8' },
  { id: 'balance', label: 'Solde disponible au retrait', value: xof(Number(r.available_balance)), icon: <HandCoins size={18} />, color: '#b45309' },
  { id: 'withdrawn', label: 'Total déjà reversé', value: xof(Number(r.withdrawn_amount)), icon: <Landmark size={18} />, color: '#15803d' },
  { id: 'subscribers', label: 'Abonnés actifs', value: r.active_subscribers_count, icon: <Users size={18} />, color: '#0f766e' },
];

/**
 * Billing of the community, read as a platform admin: billing/communities/<slug>/revenue/,
 * transactions/ and subscribers/ (owner or super-admin)
 */
function CommunityPaymentsTab() {
  const community = useDetailsCommunity();
  const free = community.pricing_type !== 'paid';
  const revenue = useGetCommunityRevenueQuery(community.slug, { skip: free });
  const transactions = useGetCommunityTransactionsQuery(community.slug, { skip: free });
  const subscribers = useGetCommunitySubscribersQuery(community.slug, { skip: free });
  const payoutsQuery = useGetCommunityPayoutsQuery(community.slug, { skip: free });

  // Payout actions
  const [selectedPayout, setSelectedPayout] = useState<CommunityPayout | null>(null);
  const [modalType, setModalType] = useState<'approve' | 'reject' | 'disburse' | null>(null);

  const [approvePayout, { isLoading: isApproving }] = useApproveAdminPayoutMutation();
  const [rejectPayout, { isLoading: isRejecting }] = useRejectAdminPayoutMutation();
  const [disbursePayout, { isLoading: isDisbursing }] = useDisburseAdminPayoutMutation();

  const handleApprove = async (payoutId: string, note?: string) => {
    try {
      await approvePayout({ payoutId, admin_note: note }).unwrap();
      payoutsQuery.refetch();
      toast.success('Demande de reversement approuvée.');
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleReject = async (payoutId: string, reason: string, note?: string) => {
    try {
      await rejectPayout({ payoutId, reason, admin_note: note }).unwrap();
      payoutsQuery.refetch();
      revenue.refetch();
      toast.success('Demande rejetée et montant remboursé.');
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleDisburse = async (payoutId: string, note?: string) => {
    try {
      const res = await disbursePayout({ payoutId, admin_note: note }).unwrap();
      payoutsQuery.refetch();
      revenue.refetch();
      toast.success(`Virement PayDunya effectué ! Réf : ${res.reference || 'Succès'}`);
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  if (free) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Wallet className="size-5" />
        </span>
        <p className="mt-4 font-semibold text-foreground">Communauté gratuite</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">Ses membres ne paient pas d'abonnement : aucun paiement à afficher.</p>
      </div>
    );
  }

  const payoutsList = payoutsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <QueryState isLoading={revenue.isLoading} error={revenue.error} onRetry={revenue.refetch} skeleton="h-80">
        {revenue.data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
              {revenueCards(revenue.data).map((card) => (
                <OverviewCardItem item={card} key={card.id} />
              ))}
            </div>
            <Section title="Encaissements" description="Revenus générés par les abonnements des membres">
              <RevenueChart
                monthly={revenue.data.monthly_revenue}
                netLabel="Revenus de la communauté"
                emptyText="Aucun paiement reçu pour l’instant."
              />
            </Section>
          </div>
        )}
      </QueryState>

      <Section title="Demandes de reversement" description="Historique et traitement des demandes de retrait de cette communauté">
        {payoutsList.length === 0 && !payoutsQuery.isLoading ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aucune demande de reversement pour cette communauté.
          </p>
        ) : (
          <AdminPayoutsTable
            payouts={payoutsList}
            isLoading={payoutsQuery.isLoading}
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
        )}
      </Section>

      <Section title="Paiements reçus">
        <TransactionsTable query={transactions} />
      </Section>

      <Section title="Abonnés">
        <SubscribersTable query={subscribers} />
      </Section>

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

export default CommunityPaymentsTab;
