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
export type PaymentCheck = {
  payment_id: string;
  status: PaymentStatus;
  is_paid: boolean;
  receipt_url: string;
  paid_at: string | null;
  community_slug?: string | null;
};

/** CommunityPlanCreateUpdateSerializer (owner and admins; the price is at least 500 FCFA) */
export type PlanWriteData = {
  name: string;
  description: string;
  price: number;
  billing_interval: BillingInterval;
  features: string[];
};

/** CommunityMemberUserSerializer: who paid (creator views) */
export type BillingUser = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url: string | null;
};

/** CommunitySubscriberSerializer (GET billing/communities/<slug>/subscribers/, owner or platform admin) */
export type CommunitySubscriber = {
  id: string;
  user: BillingUser;
  plan: Pick<CommunityPlan, 'id' | 'name' | 'price' | 'currency' | 'billing_interval'>;
  status: SubscriptionStatus;
  /** Valid now (paid period not over) */
  is_active: boolean;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
};

/** CommunityTransactionSerializer (GET billing/communities/<slug>/transactions/, owner or platform admin) */
export type CommunityTransaction = {
  id: string;
  user: BillingUser;
  plan_name: string;
  plan_interval: BillingInterval;
  /** Decimals, as strings: paid by the member, Kodinga commission, net for the creator */
  amount: string;
  platform_fee: string;
  net_amount: string;
  currency: string;
  status: PaymentStatus;
  provider: string;
  provider_reference: string;
  paid_at: string | null;
  created_at: string;
};

/** MonthlyRevenuePointSerializer: paid payments of one month (YYYY-MM) */
export type MonthlyRevenue = { month: string; gross: string; fees: string; net: string; payments_count: number };

/** CommunityRevenueOverviewSerializer (GET billing/communities/<slug>/revenue/, owner or platform admin) */
export type CommunityRevenue = {
  total_gross: string;
  total_platform_fees: string;
  total_net: string;
  available_balance: string;
  withdrawn_amount: string;
  currency: string;
  active_subscribers_count: number;
  monthly_revenue: MonthlyRevenue[];
};

export type PayoutStatus = 'pending' | 'approved' | 'processed' | 'rejected' | 'failed';
export type PayoutMethod = 'wave' | 'orange_money' | 'paydunya' | 'bank_transfer';

/** CommunityPayoutSerializer (GET / POST billing/communities/<slug>/payouts/, owner or platform admin) */
export type CommunityPayout = {
  id: string;
  community_id?: string;
  community_name?: string;
  community_slug?: string;
  requested_by_username?: string;
  requested_by_email?: string;
  amount: string;
  fee_amount?: string;
  net_amount?: string;
  currency: string;
  status: PayoutStatus;
  payment_method: PayoutMethod;
  account_identifier: string;
  account_name: string;
  reference: string;
  processed_at: string | null;
  processed_by_username?: string | null;
  rejection_reason: string;
  admin_note?: string;
  created_at: string;
  updated_at?: string;
};

export type AdminPayoutsSummary = {
  pending_count: number;
  pending_amount: string;
  processed_count: number;
  processed_amount: string;
  fees_collected: string;
};

export type AdminPayoutsResponse = {
  results: CommunityPayout[];
  summary: AdminPayoutsSummary;
  pagination?: {
    count: number;
    total_pages: number;
    current_page: number;
    has_next: boolean;
    has_previous: boolean;
    next: string | null;
    previous: string | null;
    page_size: number;
  };
};

/** CreateCommunityPayoutRequestSerializer: at least 1 000 FCFA, within the available balance */
export type PayoutRequest = { amount: number; payment_method: PayoutMethod; account_identifier: string; account_name?: string };
