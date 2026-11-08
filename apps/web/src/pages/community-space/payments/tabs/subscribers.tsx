import SubscribersTable from '@/pages/shared/billing/subscribers-table';
import { useSpaceBilling } from '../form/UseSpaceBilling';

function SubscribersTab() {
  return <SubscribersTable query={useSpaceBilling().subscribers} />;
}

export default SubscribersTab;
