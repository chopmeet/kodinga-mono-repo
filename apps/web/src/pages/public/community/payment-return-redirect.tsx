import { Navigate, useSearchParams } from 'react-router-dom';

import { Loader } from '@kodinga/ui';
import { useGetPaymentStatusQuery } from '@/utils/api/community/community.api';

const KEY = 'kodinga_pending_payment';

function getRememberedPayment(): { slug?: string; paymentId?: string } | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function PaymentReturnRedirect({ mode }: { mode: 'done' | 'cancelled' }) {
  const [params] = useSearchParams();
  const remembered = getRememberedPayment();
  const paymentId = params.get('payment_id') || remembered?.paymentId || '';

  const { data, isLoading } = useGetPaymentStatusQuery(paymentId, {
    skip: !paymentId,
  });

  if (paymentId && isLoading) {
    return <Loader inline className="py-24" message="Vérification de votre paiement PayDunya en cours…" />;
  }

  const communitySlug =
    data?.community_slug ||
    (remembered?.slug && remembered.slug !== 'kodinga-pro' ? remembered.slug : null);

  const query = new URLSearchParams();
  query.set('payment', mode);
  if (paymentId) {
    query.set('payment_id', paymentId);
  }

  if (communitySlug) {
    return <Navigate to={`/communities/${communitySlug}?${query.toString()}`} replace />;
  }

  return <Navigate to={`/dashboard/billing?${query.toString()}`} replace />;
}

export default PaymentReturnRedirect;

