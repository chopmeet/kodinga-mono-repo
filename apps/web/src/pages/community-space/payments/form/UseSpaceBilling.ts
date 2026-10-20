import { useOutletContext } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import type { CommunityPlan, PlanWriteData } from '@/utils/api/billing/billing.type';
import { useCreatePlanMutation, useDeactivatePlanMutation, useGetCommunityPlansQuery, useUpdatePlanMutation } from '@/utils/api/community/community.api';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

/** Lowest price the api accepts for a plan (CommunityPlanCreateUpdateSerializer) */
export const MIN_PRICE = 500;

export type PlanInput = PlanWriteData;

/**
 * Billing of one community for its owner: the plans (GET / POST / PATCH / DELETE billing/plans/).
 * The api lists the active plans only, and has nothing yet on the subscribers, the payments and
 * the revenue of a community: those parts of the page say so.
 */
function UseSpaceBilling(community: CommunityListItem) {
  const { data = [], isLoading } = useGetCommunityPlansQuery(community.slug);
  const [createPlan] = useCreatePlanMutation();
  const [updatePlan] = useUpdatePlanMutation();
  const [deactivatePlan] = useDeactivatePlanMutation();
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

  return { plans, isLoading, savePlan, removePlan };
}

export type SpaceBilling = ReturnType<typeof UseSpaceBilling>;

export const useSpaceBilling = () => useOutletContext<SpaceBilling>();

export default UseSpaceBilling;
