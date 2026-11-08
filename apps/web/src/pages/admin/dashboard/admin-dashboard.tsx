import type { ReactNode } from 'react';

import { ColgateWrapper, TopTitle } from '@kodinga/ui';
import { getName, useUser } from '@/utils/Utils';
import CommunitiesByAccessDonut from './charts/communities-by-access';
import PaymentMethodsBars from './charts/payment-methods';
import PlatformGrowthCharts from './charts/platform-growth';
import RecentActivities from './charts/recent-activities';
import TopCommunitiesBarChart from './charts/top-communities';
import Overview from './components/overview';

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <ColgateWrapper className="h-full min-w-0 border border-neutral-200 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-medium text-zinc-700">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </ColgateWrapper>
  );
}

function AdminDashboard() {
  const user = useUser();
  const firstName = user?.first_name || getName(user);

  return (
    <div className="admin__dashboard">
      <TopTitle title="Tableau de bord" paragraph={firstName ? `Bienvenue ${firstName} !` : 'Bienvenue !'} />

      <section aria-label="Indicateurs clés" className="mb-6">
        <Overview />
      </section>

      <div className="grid gap-3.5 pb-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-5">
          <Panel title="Croissance de la plateforme" description="Publications et nouveaux membres, 12 derniers mois">
            <PlatformGrowthCharts />
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-3">
          <Panel title="Top 6 des communautés" description="Par nombre de membres">
            <TopCommunitiesBarChart />
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Panel title="Communautés par type d'accès">
            <CommunitiesByAccessDonut />
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Panel title="Moyens de paiement" description="Montants encaissés, 30 derniers jours">
            <PaymentMethodsBars />
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-3">
          <Panel title="Activités récentes" description="Dernières actions effectuées sur la plateforme">
            <RecentActivities />
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
