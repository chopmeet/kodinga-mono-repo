import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';

import { ColgateWrapper, NavTabs, type Tab, TopTitle } from '@kodinga-mono-repo/ui';
import {
  type AdminCategory,
  type LegalPage,
  type LegalPageId,
  legalPages,
  type MonetizationSettings,
  monetizationSettings,
  platformSettings,
  type PlatformSettings,
  settingsCategories,
} from '@/data/admin-settings.data';
import { type AdminUser, adminUsers } from '@/data/admin-users.data';

const tabs: Tab[] = [
  { id: 'administrators', title: 'Super-administrateurs', link: 'administrators' },
  { id: 'general', title: 'Général', link: 'general' },
  { id: 'categories', title: 'Catégories', link: 'categories' },
  { id: 'monetization', title: 'Monétisation', link: 'monetization' },
  { id: 'terms', title: 'CGU', link: 'terms' },
  { id: 'privacy', title: 'Confidentialité', link: 'privacy' },
  { id: 'refund', title: 'Remboursement', link: 'refund' },
];

export type SettingsContext = {
  admins: AdminUser[];
  setAdmins: (update: (list: AdminUser[]) => AdminUser[]) => void;
  general: PlatformSettings;
  saveGeneral: (value: PlatformSettings) => void;
  categories: AdminCategory[];
  setCategories: (update: (list: AdminCategory[]) => AdminCategory[]) => void;
  monetization: MonetizationSettings;
  saveMonetization: (value: MonetizationSettings) => void;
  legal: Record<LegalPageId, LegalPage>;
  saveLegal: (id: LegalPageId, content: string) => void;
};

/** Tabs read and save the settings held by this page (mock: local state, lost on reload) */
export const useSettings = () => useOutletContext<SettingsContext>();

function AdminSettings() {
  const [admins, setAdmins] = useState(() => adminUsers.filter((u) => u.is_staff));
  const [general, saveGeneral] = useState(platformSettings);
  const [categories, setCategories] = useState(settingsCategories);
  const [monetization, saveMonetization] = useState(monetizationSettings);
  const [legal, setLegal] = useState(legalPages);

  const context: SettingsContext = {
    admins,
    setAdmins,
    general,
    saveGeneral,
    categories,
    setCategories,
    monetization,
    saveMonetization,
    legal,
    saveLegal: (id, content) =>
      setLegal((pages) => ({ ...pages, [id]: { ...pages[id], content, updated_at: new Date().toISOString() } })),
  };

  return (
    <div className="admin__settings">
      <TopTitle title="Paramètres" paragraph="Configuration de la plateforme" />
      <NavTabs tabs={tabs} />
      <ColgateWrapper className="border border-neutral-200 p-5">
        <Outlet context={context} />
      </ColgateWrapper>
    </div>
  );
}

export default AdminSettings;
