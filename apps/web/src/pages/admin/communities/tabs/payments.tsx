import { Wallet } from 'lucide-react';

import { useDetailsCommunity } from '../form/UseCommunityFromParams';

/** No billing endpoint per community yet: the tab says so instead of showing fake payments */
function CommunityPaymentsTab() {
  const community = useDetailsCommunity();

  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Wallet className="size-5" />
      </span>
      {community.pricing_type === 'paid' ? (
        <>
          <p className="mt-4 font-semibold text-slate-900">Paiements bientôt disponibles</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            L'API ne fournit pas encore les abonnements et paiements d'une communauté. Ils s'afficheront ici dès qu'elle les exposera.
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 font-semibold text-slate-900">Communauté gratuite</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">Ses membres ne paient pas d'abonnement : aucun paiement à afficher.</p>
        </>
      )}
    </div>
  );
}

export default CommunityPaymentsTab;
