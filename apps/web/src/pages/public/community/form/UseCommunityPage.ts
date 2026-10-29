import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import {
  useCreateCheckoutMutation,
  useGetCommunityQuery,
  useJoinCommunityMutation,
  useLeaveCommunityMutation,
} from '@/utils/api/community/community.api';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { referralCode } from '@/utils/referral';
import { communityTabs, type CommunityTabId } from '../components/community-tabs';
import { rememberPayment } from './UsePaymentReturn';

/** Where the signed-in user stands in the community */
export type Membership = 'visitor' | 'none' | 'pending' | 'member' | 'banned';

const isTab = (value: string | null): value is CommunityTabId => communityTabs.some((t) => t.id === value);

export function membershipOf(community: CommunityDetail | undefined, signedIn: boolean): Membership {
  if (!signedIn) return 'visitor';
  const m = community?.user_membership;
  if (m?.status === 'banned') return 'banned';
  if (m?.status === 'pending') return 'pending';
  if (m?.is_member && m.status === 'active') return 'member';
  return 'none';
}

/**
 * Content of the community (feed, courses) for members, or for everyone when it is public and
 * free. The api serves the feed to anyone: the page keeps private and paid content for members.
 */
export const canSeeContent = (community: CommunityDetail, membership: Membership) =>
  membership === 'member' || (community.privacy_type === 'public' && community.pricing_type === 'free');

/**
 * /communities/:slug — public page of a community (GET communities/<slug>/), and joining it:
 * POST .../join/ for a free community (pending when the team approves the members), a PayDunya
 * checkout for a paid one (the payment makes the member), POST .../leave/ to leave.
 */
function UseCommunityPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const signedIn = !!useAppSelector((s) => s.user.token);
  const { data: community, isLoading, error } = useGetCommunityQuery(slug, { skip: !slug });
  const [joinCommunity, { isLoading: isJoining }] = useJoinCommunityMutation();
  const [leaveCommunity, { isLoading: isLeaving }] = useLeaveCommunityMutation();
  const [createCheckout, { isLoading: isCheckingOut }] = useCreateCheckoutMutation();

  const tabParam = params.get('tab');
  const membership = membershipOf(community, signedIn);
  const role = community?.user_membership?.role ?? null;

  const join = async () => {
    try {
      const member = await joinCommunity(slug).unwrap();
      customToast.success({
        message: member.status === 'pending' ? 'Demande envoyée : l’équipe de la communauté va l’examiner.' : `Bienvenue dans ${community?.name} !`,
      });
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  const leave = async () => {
    try {
      await leaveCommunity(slug).unwrap();
      customToast.success({ message: `Vous avez quitté ${community?.name}.` });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  /** PayDunya: back on this page once paid (the membership is created by the payment) */
  const subscribe = async (planId: string) => {
    const back = `${window.location.origin}${pathname}`;
    try {
      const session = await createCheckout({ plan_id: planId, return_url: `${back}?payment=done`, cancel_url: `${back}?payment=cancelled`, referral_code: referralCode() }).unwrap();
      // Its status is checked on the way back
      rememberPayment(slug, session.payment_id);
      window.location.assign(session.checkout_url);
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  return {
    slug,
    community,
    isLoading,
    notFound: !community && (error as FetchBaseQueryError | undefined)?.status === 404,
    error: community ? undefined : error,
    membership,
    role,
    isTeam: membership === 'member' && !!role && role !== 'member',
    canSee: community ? canSeeContent(community, membership) : false,
    // Visitors land on "À propos" (like Skool), members on the feed
    activeTab: isTab(tabParam) ? tabParam : membership === 'member' ? 'feed' : 'about',
    loginUrl: `/auth/login?next=${encodeURIComponent(pathname)}`,
    payment: params.get('payment'),
    join,
    leave,
    subscribe,
    isJoining,
    isLeaving,
    isCheckingOut,
  };
}

export type CommunityPage = ReturnType<typeof UseCommunityPage>;

export default UseCommunityPage;
