import { HandCoins, Landmark, Users, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

import { type CardType, OverviewCardItem } from '@kodinga/ui';
import RevenueChart from '@/pages/shared/billing/revenue-chart';
import SubscribersTable from '@/pages/shared/billing/tables/subscribers-table';
import TransactionsTable from '@/pages/shared/billing/tables/transactions-table';
import QueryState from '@/pages/shared/query-state';
import {
  useGetCommunityRevenueQuery,
  useGetCommunitySubscribersQuery,
  useGetCommunityTransactionsQuery,
} from '@/utils/api/community/community.api';
import type { CommunityRevenue } from '@/utils/api/billing/billing.type';
import { xof } from '@/utils/Utils';
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
  { id: 'fees', label: 'Commission Kodinga', value: xof(Number(r.total_platform_fees)), icon: <Landmark size={18} />, color: '#15803d' },
  { id: 'balance', label: 'Solde à reverser', value: xof(Number(r.available_balance)), icon: <HandCoins size={18} />, color: '#b45309' },
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
            <Section title="Encaissements" description="Net reversé au créateur chaque mois, après la commission Kodinga">
              <RevenueChart
                monthly={revenue.data.monthly_revenue}
                netLabel="Net pour le créateur"
                emptyText="Aucun paiement reçu pour l’instant."
              />
            </Section>
          </div>
        )}
      </QueryState>

      <Section title="Paiements reçus">
        <TransactionsTable query={transactions} />
      </Section>

      <Section title="Abonnés">
        <SubscribersTable query={subscribers} />
      </Section>
    </div>
  );
}

export default CommunityPaymentsTab;
