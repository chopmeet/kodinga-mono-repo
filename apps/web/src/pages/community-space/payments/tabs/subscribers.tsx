import { Users } from 'lucide-react';

import SoonPanel from '../components/soon-panel';

/** Subscribers of the community: not served by the api yet */
function SubscribersTab() {
  return (
    <SoonPanel icon={<Users className="size-6" />} title="Abonnés">
      La liste de vos abonnés (formule, statut, prochaine échéance) arrive bientôt. En attendant, vos membres actifs sont dans l’onglet Membres.
    </SoonPanel>
  );
}

export default SubscribersTab;
