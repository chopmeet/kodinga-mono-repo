import TransactionsTable from '@/pages/shared/billing/transactions-table';
import { useSpaceBilling } from '../form/UseSpaceBilling';

function TransactionsTab() {
  return <TransactionsTable query={useSpaceBilling().transactions} />;
}

export default TransactionsTab;
