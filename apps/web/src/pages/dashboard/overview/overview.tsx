import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ColgateWrapper, TopTitle } from '@kodinga/ui';
import { useLogout } from '@/pages/auth/hooks/useLogout';
import { MemberActivityView } from '@/pages/shared/member-activity';
import { MyPointsAndBadges } from '@/pages/shared/member-points';
import { useGetMemberActivityQuery, useGetMyCommunitiesQuery, useGetMySubscriptionsQuery, useGetOwnedRevenuesQuery } from '@/utils/api/community/community.api';
import { useGetMyProfileQuery } from '@/utils/api/user/user.api';
import { formatCompact, getName, monthKey, useUser, xof } from '@/utils/Utils';

function Stat({ value, label, to }: { value: ReactNode; label: string; to: string }) {
  return (
    <Link to={to} className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <p className="text-2xl font-bold text-brand-strong tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </Link>
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
  const activity = useGetMemberActivityQuery();

  const ownedList = memberships?.filter((m) => m.role === 'owner');
  const owned = ownedList?.length;
  // Only a paid community receives payments
  const paidSlugs = (ownedList ?? []).filter((m) => m.community.pricing_type === 'paid').map((m) => m.community.slug);
  const revenues = useGetOwnedRevenuesQuery(paidSlugs, { skip: paidSlugs.length === 0 }).data;
  const month = monthKey();
  const netThisMonth =
    paidSlugs.length === 0 ? 0 : revenues?.reduce((sum, r) => sum + Number(r.monthly_revenue?.find((m) => m.month === month)?.net ?? 0), 0);
  const activeSubscriptions = subscriptions?.filter((s) => s.is_active).length;

  return (
    <div className="dashboard__overview">
      <TopTitle title={`Bonjour${user?.first_name ? `, ${user.first_name}` : ''}`} paragraph="Voici votre activité." />

      <section aria-label="Mes chiffres" className={`grid gap-4 sm:grid-cols-2 ${owned ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        {/* Owners only: net of the Kodinga commission, over the paid communities they own */}
        {!!owned && (
          <Stat
            value={netThisMonth === undefined ? '—' : xof(netThisMonth)}
            label="Reçu ce mois-ci en tant que propriétaire"
            to={paidSlugs.length === 1 ? `/c/${paidSlugs[0]}/payments/transactions` : '/dashboard/communities'}
          />
        )}
        <Stat value={figure(memberships?.length)} label="Communautés rejointes" to="/dashboard/communities" />
        <Stat value={figure(owned)} label={owned === 1 ? 'Communauté créée' : 'Communautés créées'} to="/dashboard/communities" />
        <Stat value={figure(activeSubscriptions)} label={activeSubscriptions === 1 ? 'Abonnement actif' : 'Abonnements actifs'} to="/dashboard/billing" />
        <Stat value={figure(profile?.reputation_points)} label="Points de réputation" to="/dashboard/profile" />
      </section>

      <section aria-labelledby="activity-title" className="mt-8">
        <h2 id="activity-title" className="mb-3 text-lg font-semibold text-foreground">
          Mon activité
        </h2>
        {activity.data ? (
          <MemberActivityView activity={activity.data} />
        ) : activity.isError ? (
          <p className="text-sm text-muted-foreground">Votre activité n’a pas pu être chargée.</p>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            Chargement de votre activité…
          </p>
        )}
      </section>

      <section aria-labelledby="points-title" className="mt-8">
        <h2 id="points-title" className="mb-3 text-lg font-semibold text-foreground">
          Mes points et badges
        </h2>
        <MyPointsAndBadges />
      </section>

      <ColgateWrapper className="mt-6 border border-border p-4 md:p-6">
        <section aria-labelledby="session-title" className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="session-title" className="font-semibold text-foreground">
              Session
            </h2>
            <p className="text-soft">Vous êtes connecté en tant que {getName(user) || user?.email}.</p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-body hover:border-border-strong hover:text-foreground"
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
