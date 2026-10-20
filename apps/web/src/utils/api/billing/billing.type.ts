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

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';

/** SubscriptionSerializer (GET billing/subscriptions/me/) */
export type MySubscription = {
  id: string;
  plan: CommunityPlan;
  community_id: string | null;
  status: SubscriptionStatus;
  /** Valid now (paid period not over) */
  is_active: boolean;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
};

/** PaymentDetailSerializer (GET billing/payments/my/) */
export type MyPayment = {
  id: string;
  plan: CommunityPlan | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  provider: string;
  provider_reference: string;
  checkout_url: string;
  paid_at: string | null;
  created_at: string;
};

/** PaymentStatusSerializer (GET billing/payments/<id>/status/, checks PayDunya while pending) */
export type PaymentCheck = { payment_id: string; status: PaymentStatus; is_paid: boolean; receipt_url: string; paid_at: string | null };

/** CommunityPlanCreateUpdateSerializer (owner and admins; the price is at least 500 FCFA) */
export type PlanWriteData = {
  name: string;
  description: string;
  price: number;
  billing_interval: BillingInterval;
  features: string[];
};
