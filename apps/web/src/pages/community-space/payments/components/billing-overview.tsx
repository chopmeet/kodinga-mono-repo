import { AlertTriangle, HandCoins, Users, Wallet } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga-mono-repo/ui';
import { type BillingSummary, COMMISSION_RATE } from '@/data/community-billing.data';
import { formatCompact } from '@/pages/shared/chart-theme';

function BillingOverview({ summary }: { summary: BillingSummary }) {
  const cards: CardType[] = [
    { id: 'gross', label: 'Encaissé (30 j)', value: `${formatCompact(summary.gross30d)} FCFA`, icon: <Wallet size={18} />, color: '#15803d' },
    {
      id: 'net',
      label: `Net pour vous (après ${Math.round(COMMISSION_RATE * 100)} % de commission)`,
      value: `${formatCompact(summary.net30d)} FCFA`,
      icon: <HandCoins size={18} />,
      color: '#1D4ED8',
    },
    { id: 'subscribers', label: 'Abonnés actifs', value: summary.activeSubscribers, icon: <Users size={18} />, color: '#0f766e' },
    { id: 'watch', label: 'Paiements en attente ou en échec', value: summary.toWatch, icon: <AlertTriangle size={18} />, color: '#b45309' },
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
