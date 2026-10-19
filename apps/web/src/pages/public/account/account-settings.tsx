import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { NavTabs, type Tab } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';

const tabs: Tab[] = [
  { id: 'profile', title: 'Profil', link: 'profile' },
  { id: 'skills', title: 'Compétences', link: 'skills' },
  { id: 'career', title: 'Parcours', link: 'career' },
  { id: 'portfolio', title: 'Portfolio', link: 'portfolio' },
  { id: 'security', title: 'Sécurité', link: 'security' },
];

/** /account — the account of the signed-in user: public profile, career, portfolio, security */
function AccountSettings() {
  const signedIn = !!useAppSelector((s) => s.user.token);
  const { pathname } = useLocation();
  if (!signedIn) return <Navigate to={`/auth/login?next=${encodeURIComponent(pathname)}`} replace />;

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="mx-auto max-w-285 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mon compte</h1>
        <p className="mt-1 text-slate-500">Votre profil de développeur, votre parcours et la sécurité de votre compte.</p>
        <div className="mt-6">
          <NavTabs tabs={tabs} />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 md:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
