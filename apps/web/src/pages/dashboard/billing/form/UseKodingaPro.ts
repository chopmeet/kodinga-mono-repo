import { useSearchParams } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import UsePaymentReturn, { PRO_SCOPE, rememberPayment } from '@/pages/public/community/form/UsePaymentReturn';
import { useCreateCheckoutMutation, useGetMySubscriptionsQuery, useGetProPlansQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { referralCode } from '@/utils/referral';
import { isAdmin, useUser } from '@/utils/Utils';

/**
 * Kodinga Pro on /c: the plans with no community (billing/plans/), the user's Pro subscription
 * (billing/subscriptions/me/, community_id null) and its PayDunya checkout, back on /c?payment=.
 * The api needs Pro to make a community paid and to create its plans.
 */
function UseKodingaPro() {
  const user = useUser();
  const [params] = useSearchParams();
  const plans = useGetProPlansQuery(undefined, { skip: !user });
  const subscriptions = useGetMySubscriptionsQuery(undefined, { skip: !user });
  const [createCheckout, { isLoading: isCheckingOut, originalArgs }] = useCreateCheckoutMutation();
  const payment = UsePaymentReturn(PRO_SCOPE, params.get('payment'));

  const subscription = (subscriptions.data ?? []).find((s) => s.community_id === null && s.is_active);
  // Superadmins are Pro without a subscription (User.is_pro of the api)
  const isPro = !!subscription || isAdmin(user);

  const subscribe = async (planId: string) => {
    const back = `${window.location.origin}/dashboard/billing`;
    try {
      const session = await createCheckout({ plan_id: planId, return_url: `${back}?payment=done`, cancel_url: `${back}?payment=cancelled`, referral_code: referralCode() }).unwrap();
      rememberPayment(PRO_SCOPE.slug, session.payment_id);
      window.location.assign(session.checkout_url);
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  return {
    plans: plans.data ?? [],
    isLoading: plans.isLoading || subscriptions.isLoading,
    error: plans.error,
    isPro,
    subscription,
    payment,
    subscribe,
    /** Plan whose checkout is being opened */
    checkingOut: isCheckingOut ? originalArgs?.plan_id : undefined,
  };
}

export type KodingaPro = ReturnType<typeof UseKodingaPro>;

export default UseKodingaPro;
