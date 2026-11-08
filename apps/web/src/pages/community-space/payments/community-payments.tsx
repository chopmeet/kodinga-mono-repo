import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { ColgateWrapper, NavTabs, type Tab, TopTitle } from '@kodinga/ui';
import { useCommunitySpace } from '../community-space-context';
import BillingOverview from './components/billing-overview';
import RevenueChart from './components/revenue-chart';
import UseSpaceBilling from './form/UseSpaceBilling';

const tabs: Tab[] = [
  { id: 'plans', title: 'Formules', link: 'plans' },
  { id: 'subscribers', title: 'Abonnés', link: 'subscribers' },
  { id: 'transactions', title: 'Paiements', link: 'transactions' },
  { id: 'payouts', title: 'Reversements', link: 'payouts' },
];

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <ColgateWrapper className="min-w-0 border border-neutral-200 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-medium text-zinc-700">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </ColgateWrapper>
  );
}

/** /c/:slug/payments: owner of a paid community only (SectionGuard "payments") */
function CommunityPayments() {
  const { community } = useCommunitySpace();
  const billing = UseSpaceBilling(community);

  return (
    <div className="community__payments">
      <TopTitle title="Abonnements & paiements" paragraph={`Formules, abonnés et encaissements de ${community.name}`} />

      <section aria-label="Indicateurs de facturation" className="mb-6">
        <BillingOverview plans={billing.plans} revenue={billing.revenue.data} />
      </section>

      <div className="mb-6">
        <Panel title="Encaissements" description="Ce qui vous revient chaque mois, net de la commission Kodinga">
          <RevenueChart monthly={billing.revenue.data?.monthly_revenue ?? []} />
        </Panel>
      </div>

      <NavTabs tabs={tabs} />
      <ColgateWrapper className="mt-4 border border-neutral-200 p-4">
        <Outlet context={billing} />
      </ColgateWrapper>
    </div>
  );
}

export default CommunityPayments;
