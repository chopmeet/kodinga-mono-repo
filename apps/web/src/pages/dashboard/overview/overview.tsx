import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ColgateWrapper, TopTitle } from '@kodinga-mono-repo/ui';
import { useLogout } from '@/pages/auth/hooks/useLogout';
import { useGetMyCommunitiesQuery, useGetMySubscriptionsQuery } from '@/utils/api/community/community.api';
import { useGetMyProfileQuery } from '@/utils/api/user/user.api';
import { formatCompact, getName, useUser } from '@/utils/Utils';

function Stat({ value, label, to }: { value: ReactNode; label: string; to: string }) {
  return (
    <Link to={to} className="rounded-xl border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-md">
      <p className="text-2xl font-bold text-blue-900 tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </Link>
  );
}

/** A figure the api does not serve yet: said plainly, without a made-up amount (see SoonPanel) */
function SoonStat({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Bientôt</span>
      <p className="mt-2 text-sm text-slate-500">{label}</p>
    </div>
  );
}

/** A figure still loading (or missing): a dash, not a made-up zero */
const figure = (n: number | undefined) => (n === undefined ? '—' : formatCompact(n));


function Overview() {
  const user = useUser();
  const { logout } = useLogout();
  const memberships = useGetMyCommunitiesQuery().data;
  const subscriptions = useGetMySubscriptionsQuery().data;
  const profile = useGetMyProfileQuery().data;

  const owned = memberships?.filter((m) => m.role === 'owner').length;
  const activeSubscriptions = subscriptions?.filter((s) => s.is_active).length;

  return (
    <div className="dashboard__overview">
      <TopTitle title={`Bonjour${user?.first_name ? `, ${user.first_name}` : ''}`} paragraph="Voici votre activité." />

      <section aria-label="Mes chiffres" className={`grid gap-4 sm:grid-cols-2 ${owned ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        {/* Owners only: the payments of their members, until the api serves them */}
        {!!owned && <SoonStat label="Total reçu en tant que propriétaire (30 j)" />}
        <Stat value={figure(memberships?.length)} label="Communautés rejointes" to="/dashboard/communities" />
        <Stat value={figure(owned)} label={owned === 1 ? 'Communauté créée' : 'Communautés créées'} to="/dashboard/communities" />
        <Stat value={figure(activeSubscriptions)} label={activeSubscriptions === 1 ? 'Abonnement actif' : 'Abonnements actifs'} to="/dashboard/billing" />
        <Stat value={figure(profile?.reputation_points)} label="Points de réputation" to="/dashboard/profile" />
      </section>

      <ColgateWrapper className="mt-6 border border-neutral-200 p-4 md:p-6">
        <section aria-labelledby="session-title" className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="session-title" className="font-semibold text-slate-900">
              Session
            </h2>
            <p className="text-slate-600">Vous êtes connecté en tant que {getName(user) || user?.email}.</p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            <LogOut className="size-4" />
            Se déconnecter
          </button>
        </section>
      </ColgateWrapper>
    </div>
  );
}

export default Overview;
