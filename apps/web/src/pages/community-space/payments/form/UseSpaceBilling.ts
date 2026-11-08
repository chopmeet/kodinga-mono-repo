import { useOutletContext } from 'react-router-dom';

import { customToast } from '@kodinga/ui';
import type { CommunityPlan, PayoutRequest, PlanWriteData } from '@/utils/api/billing/billing.type';
import {
  useCreatePlanMutation,
  useDeactivatePlanMutation,
  useGetCommunityPayoutsQuery,
  useGetCommunityPlansQuery,
  useGetCommunityRevenueQuery,
  useGetCommunitySubscribersQuery,
  useGetCommunityTransactionsQuery,
  useRequestPayoutMutation,
  useUpdatePlanMutation,
} from '@/utils/api/community/community.api';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

/** Lowest price the api accepts for a plan (CommunityPlanCreateUpdateSerializer) */
export const MIN_PRICE = 500;

/** Lowest payout the api accepts (CreateCommunityPayoutRequestSerializer) */
export const MIN_PAYOUT = 1000;

export type PlanInput = PlanWriteData;

/**
 * Billing of one community for its owner: the plans (billing/plans/), then the subscribers, the
 * payments received, the revenue and the payouts (billing/communities/<slug>/...). The api lists
 * the active plans only.
 */
function UseSpaceBilling(community: CommunityListItem) {
  const { data = [], isLoading } = useGetCommunityPlansQuery(community.slug);
  const revenue = useGetCommunityRevenueQuery(community.slug);
  const subscribers = useGetCommunitySubscribersQuery(community.slug);
  const transactions = useGetCommunityTransactionsQuery(community.slug);
  const payouts = useGetCommunityPayoutsQuery(community.slug);
  const [createPlan] = useCreatePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();
  const [deactivatePlan] = useDeactivatePlanMutation();
  const [sendPayout] = useRequestPayoutMutation();
  const plans = [...data].filter((p) => p.is_active).sort((a, b) => a.order - b.order || Number(a.price) - Number(b.price));

  /** true once the api accepted it: the dialog closes */
  const savePlan = async (input: PlanInput, editing: CommunityPlan | null) => {
    try {
      if (editing) await updatePlan({ planId: editing.id, ...input }).unwrap();
      else await createPlan({ community_id: community.id, ...input }).unwrap();
      customToast.success({ message: editing ? `Formule « ${input.name} » mise à jour.` : `Formule « ${input.name} » créée.` });
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };

  const removePlan = async (plan: CommunityPlan) => {
    // A paid community always keeps one plan open to new members
    if (plans.length <= 1) {
      customToast.error({ message: 'Gardez au moins une formule pour accueillir de nouveaux membres.' });
      return;
    }
    try {
      await deactivatePlan(plan.id).unwrap();
      customToast.success({ message: `« ${plan.name} » n’est plus proposée aux nouveaux membres.` });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  /** true once the api accepted it: the amount leaves the available balance, the dialog closes */
  const requestPayout = async (input: PayoutRequest) => {
    try {
      await sendPayout({ slug: community.slug, ...input }).unwrap();
      customToast.success({ message: 'Demande de reversement enregistrée : elle sera traitée sous 24 à 48 h.' });
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };

  return { plans, isLoading, savePlan, removePlan, revenue, subscribers, transactions, payouts, requestPayout };
}

export type SpaceBilling = ReturnType<typeof UseSpaceBilling>;

export const useSpaceBilling = () => useOutletContext<SpaceBilling>();

export default UseSpaceBilling;
