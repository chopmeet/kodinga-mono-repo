import { ColgateWrapper, TopTitle } from '@kodinga/ui';
import BillingHistory from './components/billing-history';
import { ProPlans } from './components/pro-plans';
import UseKodingaPro from './form/UseKodingaPro';

/** /dashboard/billing — the paid memberships of the user, their payments, and Kodinga Pro */
function Billing() {
  const pro = UseKodingaPro();

  return (
    <div className="dashboard__billing">
      <TopTitle title="Facturation" paragraph="Vos abonnements, vos paiements et votre formule Kodinga." />
      <ColgateWrapper className="border border-border p-4 md:p-6">
        <BillingHistory />
      </ColgateWrapper>
      <ColgateWrapper className="mt-6 border border-border p-4 md:p-6">
        <ProPlans pro={pro} />
      </ColgateWrapper>
    </div>
  );
}

export default Billing;
