import { Receipt } from 'lucide-react';

import SoonPanel from '../components/soon-panel';

/** Payments received by the community: not served by the api yet */
function TransactionsTab() {
  return (
    <SoonPanel icon={<Receipt className="size-6" />} title="Paiements">
      L’historique des paiements reçus via PayDunya, avec la commission Kodinga et le net pour vous, arrive bientôt.
    </SoonPanel>
  );
}

export default TransactionsTab;
