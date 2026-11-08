import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';

import { ColgateWrapper, NavTabs, type Tab, TopTitle } from '@kodinga/ui';
import {
  type LegalPage,
  type LegalPageId,
  legalPages,
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
  { id: 'terms', title: 'CGU', link: 'terms' },
  { id: 'privacy', title: 'Confidentialité', link: 'privacy' },
  { id: 'refund', title: 'Remboursement', link: 'refund' },
];

export type SettingsContext = {
  general: PlatformSettings;
  saveGeneral: (value: PlatformSettings) => void;
  monetization: MonetizationSettings;
  saveMonetization: (value: MonetizationSettings) => void;
  legal: Record<LegalPageId, LegalPage>;
  saveLegal: (id: LegalPageId, content: string) => void;
};

/** Tabs read and save the settings held by this page (mock: local state, lost on reload) */
export const useSettings = () => useOutletContext<SettingsContext>();

function AdminSettings() {
  const [general, saveGeneral] = useState(platformSettings);
  const [monetization, saveMonetization] = useState(monetizationSettings);
  const [legal, setLegal] = useState(legalPages);

  const context: SettingsContext = {
    general,
    saveGeneral,
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
