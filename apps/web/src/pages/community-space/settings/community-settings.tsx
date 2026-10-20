import { Outlet } from 'react-router-dom';

import { ColgateWrapper, NavTabs, type Tab, TopTitle } from '@kodinga-mono-repo/ui';
import { canAccess, useCommunitySpace } from '../community-space-context';
import UseSpaceSettings from './form/UseSpaceSettings';

/** /c/:slug/settings: owner and admins; the danger zone is the owner's only */
function CommunitySettings() {
  const space = useCommunitySpace();
  const settings = UseSpaceSettings(space.community);

  const tabs: Tab[] = [
    { id: 'general', title: 'Informations', link: 'general' },
    { id: 'access', title: 'Accès & publication', link: 'access' },
    ...(canAccess(space, 'roles') ? [{ id: 'roles', title: 'Rôles & Permissions', link: 'roles' }] : []),
    { id: 'rules', title: 'Règles', link: 'rules' },
    { id: 'ai', title: 'Intelligence Artificielle', link: 'ai' },
    ...(canAccess(space, 'danger') ? [{ id: 'danger', title: 'Zone sensible', link: 'danger' }] : []),
  ];

  return (
    <div className="community__settings">
      <TopTitle title="Paramètres" paragraph={`Profil, accès et règles de ${space.community.name}`} />
      <NavTabs tabs={tabs} />
      <ColgateWrapper className="mt-4 border border-neutral-200 p-4 md:p-6">
        <Outlet context={settings} />
      </ColgateWrapper>
    </div>
  );
}

export default CommunitySettings;
