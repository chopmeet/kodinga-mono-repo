// Billing (apps/billing): membership plans of a paid community and the PayDunya checkout.

export type BillingInterval = 'month' | 'year' | 'one_time';

/** PlanSerializer (GET billing/plans/?community=<slug>) */
export type CommunityPlan = {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** Decimal, as a string */
  price: string;
  currency: string;
  billing_interval: BillingInterval;
  interval_count: number;
  community_id: string | null;
  community_name: string | null;
  features: string[];
  is_active: boolean;
  order: number;
};

/** CheckoutResponseSerializer (POST billing/checkout/) */
export type CheckoutSession = {
  payment_id: string;
  token: string;
  checkout_url: string;
  amount: string;
  currency: string;
  plan_name: string;
};
