import type { ReactNode } from 'react';

import { ColgateWrapper, TopTitle } from '@kodinga/ui';
import { getName, useUser } from '@/utils/Utils';
import CommunitiesByAccessDonut from './charts/communities-by-access';
import PaymentMethodsBars from './charts/payment-methods';
import PlatformGrowthCharts from './charts/platform-growth';
import RecentActivities from './charts/recent-activities';
import TopCommunitiesBarChart from './charts/top-communities';
import Overview from './components/overview';
import QueryState from '@/pages/shared/query-state';
import useAdminDashboard from './form/UseAdminDashboard';

type PanelProps = {
  title: string;
  description?: string;
  /** Block still on mock data (data/admin-dashboard.data.ts): the api does not serve it yet */
  mock?: boolean;
  children: ReactNode;
};

function Panel({ title, description, mock, children }: PanelProps) {
  return (
    <ColgateWrapper className="h-full min-w-0 border border-neutral-200 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-zinc-700">{title}</h2>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {mock && (
          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Données fictives
          </span>
        )}
      </div>
      {children}
    </ColgateWrapper>
  );
}

function AdminDashboard() {
  const user = useUser();
  const firstName = user?.first_name || getName(user);
  const { 
    kpis, 
    kpisLoading, 
    kpisError, 
    refetchKpis, 
    topCommunities, 
    communities, 
    activities, 
    dashboard 
  } = useAdminDashboard();

  return (
    <div className="admin__dashboard">
      <TopTitle title="Tableau de bord" paragraph={firstName ? `Bienvenue ${firstName} !` : 'Bienvenue !'} />

      <section aria-label="Indicateurs clés" className="mb-6">
        <QueryState isLoading={kpisLoading} error={kpisError} onRetry={refetchKpis} skeleton="h-56">
          <Overview kpis={kpis} />
        </QueryState>
      </section>

      <div className="grid gap-3.5 pb-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-5">
          <Panel title="Croissance de la plateforme" description="Publications et nouveaux membres, 12 derniers mois" mock>
            <PlatformGrowthCharts />
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-3">
          <Panel title="Top 6 des communautés" description="Par nombre de membres">
            <QueryState isLoading={communities.isLoading} error={communities.error} onRetry={communities.refetch} skeleton="h-72">
              <TopCommunitiesBarChart communities={topCommunities} />
            </QueryState>
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Panel title="Communautés par type d'accès" mock>
            <CommunitiesByAccessDonut />
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Panel title="Moyens de paiement" description="Montants encaissés, 30 derniers jours" mock>
            <PaymentMethodsBars />
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-3">
          <Panel title="Activités récentes" description="Dernières actions d'administration sur la plateforme">
            <QueryState isLoading={dashboard.isLoading} error={dashboard.error} onRetry={dashboard.refetch}>
              <RecentActivities activities={activities} />
            </QueryState>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
