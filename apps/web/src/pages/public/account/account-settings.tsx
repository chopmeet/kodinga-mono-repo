import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ColgateWrapper, TopTitle } from '@kodinga-mono-repo/ui';
import DashboardLayout from '@/layouts/dashboard-layout';
import { useAppSelector } from '@/redux/hook';

/** Title of each section of the account (the menu is in the sidebar, see dashboard-sidebar) */
const sections: Record<string, { title: string; paragraph: string }> = {
  profile: { title: 'Profil', paragraph: 'Ce que les autres voient sur votre profil public.' },
  skills: { title: 'Compétences', paragraph: 'Votre stack technique, avec un niveau pour chaque technologie.' },
  career: { title: 'Parcours', paragraph: 'Vos expériences et vos formations, de la plus récente à la plus ancienne.' },
  portfolio: { title: 'Portfolio', paragraph: 'Les projets montrés sur votre profil public.' },
  billing: { title: 'Abonnements', paragraph: 'Vos adhésions payantes et leurs paiements.' },
  security: { title: 'Sécurité', paragraph: 'Votre mot de passe et les appareils connectés à votre compte.' },
};

/** /account — the account of the signed-in user, as a dashboard: public profile, career, portfolio, security */
function AccountSettings() {
  const signedIn = !!useAppSelector((s) => s.user.token);
  const { pathname } = useLocation();
  if (!signedIn) return <Navigate to={`/auth/login?next=${encodeURIComponent(pathname)}`} replace />;

  const section = sections[pathname.split('/')[2] ?? ''];

  return (
    <DashboardLayout>
      <div className="account__settings">
        {section && <TopTitle title={section.title} paragraph={section.paragraph} />}
        <ColgateWrapper className="mt-4 border border-neutral-200 p-4 md:p-6">
          <Outlet />
        </ColgateWrapper>
      </div>
    </DashboardLayout>
  );
}

export default AccountSettings;
