import { useSearchParams } from 'react-router-dom';

import { useAppDispatch } from '@/redux/hook';
import UsePaymentReturn, { PRO_SCOPE, rememberPayment } from '@/pages/public/community/form/UsePaymentReturn';
import { useGetPublicSettingsQuery } from '@/utils/api/admin/admin.api';
import { COMMUNITY_CREATION_KEY } from '@/utils/api/admin/admin.type';
import type { CommunityPlan } from '@/utils/api/billing/billing.type';
import { CommunityApi, useCreateCheckoutMutation, useGetMySubscriptionsQuery, useGetProPlansQuery } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
import { referralCode } from '@/utils/referral';
import { isAdmin, useUser } from '@/utils/Utils';

const ORDER: CommunityPlan['billing_interval'][] = ['month', 'year', 'one_time'];

/** Kodinga Pro plans of the api (no community, a price): monthly, yearly, lifetime, in that order */
export const proPlansOf = (plans: unknown) =>
  (Array.isArray(plans) ? (plans as CommunityPlan[]) : [])
    .filter((p) => !p.community_id && Number(p.price) > 0)
    .sort((a, b) => ORDER.indexOf(a.billing_interval) - ORDER.indexOf(b.billing_interval));

/** The setting is a word, or { tier } (CommunityService reads both) */
const tierOf = (value: unknown) => String(value && typeof value === 'object' ? (value as { tier?: unknown }).tier : value).toLowerCase();

/**
 * Kodinga Pro inside /create-community: the plans (prices set by the superadmin), whether the user
 * already is Pro, the PayDunya checkout (back on /create-community?payment=) and its result. The api
 * needs an active Pro to create a paid community, and may reserve every creation to Pro
 * (community_creation_allowed_for = pro_only).
 */
function UseProChoice() {
  const user = useUser();
  const dispatch = useAppDispatch();
  const [params] = useSearchParams();
  const plans = useGetProPlansQuery();
  const subscriptions = useGetMySubscriptionsQuery(undefined, { skip: !user });
  const settings = useGetPublicSettingsQuery();
  const [createCheckout, { isLoading: isCheckingOut }] = useCreateCheckoutMutation();
  const payment = UsePaymentReturn(PRO_SCOPE, params.get('payment'));

  const isProUser = (u: User | null, subs: { community_id: string | null; is_active: boolean }[] | undefined) =>
    isAdmin(u) || (subs ?? []).some((s) => s.community_id === null && s.is_active);

  // Not a list (api error page, older api): creation stays open to all, like the api's default
  const publicSettings = Array.isArray(settings.data) ? settings.data : [];
  const proOnly = tierOf(publicSettings.find((s) => s.key === COMMUNITY_CREATION_KEY)?.value) === 'pro_only';

  /** Right after signing in inside the flow: is this account Pro already? (then no payment) */
  const fetchIsPro = async (signedIn: User) => {
    try {
      const subs = await dispatch(CommunityApi.endpoints.getMySubscriptions.initiate(undefined, { forceRefetch: true })).unwrap();
      return isProUser(signedIn, Array.isArray(subs) ? subs : []);
    } catch {
      return isAdmin(signedIn);
    }
  };

  /** Opens PayDunya for this Pro plan; false when the api refused (the message is returned) */
  const checkout = async (planId: string) => {
    const back = `${window.location.origin}/create-community`;
    const session = await createCheckout({
      plan_id: planId,
      return_url: `${back}?payment=done`,
      cancel_url: `${back}?payment=cancelled`,
      referral_code: referralCode(),
    }).unwrap();
    rememberPayment(PRO_SCOPE.slug, session.payment_id);
    window.location.assign(session.checkout_url);
  };

  return {
    plans: proPlansOf(plans.data),
    plansLoading: plans.isLoading,
    isPro: isProUser(user, Array.isArray(subscriptions.data) ? subscriptions.data : []),
    /** The Pro status is still being read (signed-in user) */
    isProLoading: !!user && subscriptions.isLoading,
    proOnly,
    payment,
    fetchIsPro,
    checkout,
    isCheckingOut,
  };
}

export type ProChoice = ReturnType<typeof UseProChoice>;

export default UseProChoice;
