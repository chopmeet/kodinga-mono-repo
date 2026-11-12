import { ArrowUpRight, BriefcaseBusiness, Code, FolderKanban, ShieldCheck, UserRound } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';

import { ColgateWrapper, NavTabs, type Tab, TopTitle } from '@kodinga/ui';
import { useUser } from '@/utils/Utils';

const tabs: Tab[] = [
  { id: 'general', title: 'Profil', link: 'general', icon: <UserRound className="size-4" /> },
  { id: 'skills', title: 'Compétences', link: 'skills', icon: <Code className="size-4" /> },
  { id: 'career', title: 'Parcours', link: 'career', icon: <BriefcaseBusiness className="size-4" /> },
  { id: 'portfolio', title: 'Portfolio', link: 'portfolio', icon: <FolderKanban className="size-4" /> },
  { id: 'security', title: 'Sécurité', link: 'security', icon: <ShieldCheck className="size-4" /> },
];

function ProfileSettings() {
  const user = useUser();

  return (
    <div className="profile__settings">
      <div className="flex flex-wrap items-start justify-between gap-4 [&>:last-child]:mb-4">
        <TopTitle title="Mon profil" paragraph="Ces informations s’affichent sur votre profil public." />
        {user?.username && (
          <Link
            to={`/profiles/${user.username}`}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-body hover:border-border-strong hover:text-foreground"
          >
            Voir le profil public
            <ArrowUpRight className="size-4" />
          </Link>
        )}
      </div>
      <NavTabs tabs={tabs} />
      <ColgateWrapper className="border border-neutral-200 p-4 md:p-6">
        <Outlet />
      </ColgateWrapper>
    </div>
  );
}

export default ProfileSettings;
