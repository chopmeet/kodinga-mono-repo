import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';

import { ColgateWrapper, NavTabs, type Tab, TopTitle } from '@kodinga/ui';
import {
  type MonetizationSettings,
  monetizationSettings,
  platformSettings,
  type PlatformSettings,
} from '@/data/admin-settings.data';

const tabs: Tab[] = [
  { id: 'administrators', title: 'Super-administrateurs', link: 'administrators' },
  { id: 'general', title: 'Général', link: 'general' },
  { id: 'categories', title: 'Catégories', link: 'categories' },
  { id: 'monetization', title: 'Monétisation', link: 'monetization' },
];

export type SettingsContext = {
  general: PlatformSettings;
  saveGeneral: (value: PlatformSettings) => void;
  monetization: MonetizationSettings;
  saveMonetization: (value: MonetizationSettings) => void;
};

/** Tabs read and save the settings held by this page (mock: local state, lost on reload) */
export const useSettings = () => useOutletContext<SettingsContext>();

function AdminSettings() {
  const [general, saveGeneral] = useState(platformSettings);
  const [monetization, saveMonetization] = useState(monetizationSettings);

  const context: SettingsContext = {
    general,
    saveGeneral,
    monetization,
    saveMonetization,
  };

  return (
    <div className="admin__settings">
      <TopTitle title="Paramètres" paragraph="Configuration de la plateforme" />
      <NavTabs tabs={tabs} />
      <ColgateWrapper className="border border-border p-5">
        <Outlet context={context} />
      </ColgateWrapper>
    </div>
  );
}

export default AdminSettings;
