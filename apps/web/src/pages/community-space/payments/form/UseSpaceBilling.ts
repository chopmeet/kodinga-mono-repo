import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import { type AdminPayment, getCommunityPayments } from '@/data/admin-community-details.data';
import {
  getCommunityPlans,
  getCommunitySubscriptions,
  type SpacePlan,
  type SpaceSubscription,
} from '@/data/community-billing.data';
import type { CommunityListItem } from '@/utils/api/community/community.type';

export type PlanInput = Pick<SpacePlan, 'name' | 'description' | 'price' | 'billing_interval' | 'features'>;

/**
 * Billing of one community for its owner. Mock: plan changes live in local state, shared by the
 * three tabs through the Outlet context. With the api: plans CRUD scoped to the community,
 * GET subscriptions / payments of the community.
 */
function UseSpaceBilling(community: CommunityListItem) {
  const [plans, setPlans] = useState<SpacePlan[]>(() => getCommunityPlans(community));
  const [subscriptions] = useState<SpaceSubscription[]>(() => getCommunitySubscriptions(community));
  const [payments] = useState<AdminPayment[]>(() => getCommunityPayments(community));

  const savePlan = (input: PlanInput, editing: SpacePlan | null) => {
    if (editing) {
      setPlans((list) => list.map((p) => (p.id === editing.id ? { ...p, ...input } : p)));
      customToast.success({ message: `Formule « ${input.name} » mise à jour.` });
      return;
    }
    setPlans((list) => [
      ...list,
      { ...input, id: `${community.slug}-plan-${Date.now()}`, currency: 'XOF', is_active: true, order: list.length + 1, subscribers_count: 0 },
    ]);
    customToast.success({ message: `Formule « ${input.name} » créée.` });
  };

  const togglePlan = (plan: SpacePlan) => {
    // A paid community always keeps one plan open to new members
    if (plan.is_active && plans.filter((p) => p.is_active).length <= 1) {
      customToast.error({ message: 'Gardez au moins une formule active pour accueillir de nouveaux membres.' });
      return;
    }
    setPlans((list) => list.map((p) => (p.id === plan.id ? { ...p, is_active: !p.is_active } : p)));
    customToast.success({
      message: plan.is_active ? `« ${plan.name} » n'est plus proposée aux nouveaux membres.` : `« ${plan.name} » est de nouveau proposée.`,
    });
  };

  const remind = (s: SpaceSubscription) => customToast.success({ message: `Rappel de paiement envoyé à ${s.member}.` });

  return { plans, subscriptions, payments, savePlan, togglePlan, remind };
}

export type SpaceBilling = ReturnType<typeof UseSpaceBilling>;

export const useSpaceBilling = () => useOutletContext<SpaceBilling>();

export default UseSpaceBilling;
