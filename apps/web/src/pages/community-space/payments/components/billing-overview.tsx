import { Layers, PiggyBank, Users, Wallet } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga-mono-repo/ui';
import { intervalLabel, xof } from '@/utils/Utils';
import type { CommunityPlan, CommunityRevenue } from '@/utils/api/billing/billing.type';

/** Key figures of the billing: the plans, then the subscribers and the net revenue (billing/communities/<slug>/revenue/) */
function BillingOverview({ plans, revenue }: { plans: CommunityPlan[]; revenue: CommunityRevenue | undefined }) {
  const cheapest = [...plans].sort((a, b) => Number(a.price) - Number(b.price))[0];
  const cards: CardType[] = [
    { id: 'plans', label: 'Formules proposées', value: plans.length, icon: <Layers size={18} />, color: '#1D4ED8' },
    {
      id: 'entry',
      label: 'Prix d’entrée',
      value: cheapest ? `${xof(Number(cheapest.price))} ${intervalLabel[cheapest.billing_interval]?.suffix ?? ''}` : '—',
      icon: <Wallet size={18} />,
      color: '#15803d',
    },
    { id: 'subscribers', label: 'Abonnés actifs', value: revenue ? revenue.active_subscribers_count : '—', icon: <Users size={18} />, color: '#0f766e' },
    {
      id: 'net',
      label: 'Revenus nets (total)',
      value: revenue ? xof(Number(revenue.total_net)) : '—',
      icon: <PiggyBank size={18} />,
      color: '#b45309',
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <OverviewCardItem item={card} key={card.id} />
      ))}
    </div>
  );
}

export default BillingOverview;
