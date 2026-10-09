// Mock billing data of a paid community, seen by its owner in /c/:slug/payments.
// Shapes mirror the api (billing/models: Plan, Subscription, Payment). Deterministic per slug.
// With the api: plans scoped to the community, its subscriptions and payments (endpoints to add).
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { getCommunityMembers, getCommunityPayments } from './admin-community-details.data';
import { monetizationSettings } from './admin-settings.data';

export type BillingInterval = 'month' | 'year' | 'one_time';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

export type SpacePlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: 'XOF';
  billing_interval: BillingInterval;
  features: string[];
  is_active: boolean;
  order: number;
  subscribers_count: number;
};

export type SpaceSubscription = {
  id: string;
  member: string;
  plan_id: string;
  plan: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
};

/** Share kept by Kodinga on every payment (admin > Paramètres > Monétisation) */
export const COMMISSION_RATE = monetizationSettings.commission_rate / 100;
export const MIN_PRICE = monetizationSettings.min_monthly_price;

const TODAY = Date.UTC(2026, 9, 9);
const daysFrom = (days: number) => new Date(TODAY + days * 86_400_000).toISOString();

export function getCommunityPlans(community: CommunityListItem): SpacePlan[] {
  const subs = getCommunitySubscriptions(community);
  const count = (id: string) => subs.filter((s) => s.plan_id === id && (s.status === 'active' || s.status === 'trialing')).length;
  return [
    {
      id: `${community.slug}-plan-month`,
      name: 'Mensuel',
      description: 'Accès complet à la communauté, sans engagement.',
      price: 15_000,
      currency: 'XOF',
      billing_interval: 'month',
      features: ['Fil et discussions', 'Lives mensuels', 'Ressources partagées'],
      is_active: true,
      order: 1,
      subscribers_count: count(`${community.slug}-plan-month`),
    },
    {
      id: `${community.slug}-plan-year`,
      name: 'Annuel',
      description: 'Deux mois offerts par rapport au mensuel.',
      price: 150_000,
      currency: 'XOF',
      billing_interval: 'year',
      features: ['Tout le mensuel', 'Replays des lives', 'Revue de code trimestrielle'],
      is_active: true,
      order: 2,
      subscribers_count: count(`${community.slug}-plan-year`),
    },
  ];
}

export function getCommunitySubscriptions(community: CommunityListItem): SpaceSubscription[] {
  if (community.pricing_type !== 'paid') return [];
  // Every paying member of the sample, the status cycling through the realistic cases
  return getCommunityMembers(community)
    .filter((m) => m.role === 'member' && m.status !== 'pending')
    .map((m, i) => {
      const yearly = i % 5 === 1;
      const status: SubscriptionStatus =
        m.status === 'banned' ? 'canceled' : i % 9 === 3 ? 'past_due' : i % 11 === 6 ? 'trialing' : i % 13 === 8 ? 'expired' : 'active';
      const start = -((i * 7) % (yearly ? 300 : 28));
      const end = start + (status === 'trialing' ? 14 : yearly ? 365 : 30);
      return {
        id: `${community.slug}-sub${i}`,
        member: m.name,
        plan_id: `${community.slug}-plan-${yearly ? 'year' : 'month'}`,
        plan: yearly ? 'Annuel' : 'Mensuel',
        status,
        current_period_start: daysFrom(status === 'expired' ? start - 40 : start),
        current_period_end: daysFrom(status === 'expired' ? end - 40 : end),
        cancel_at_period_end: status === 'canceled' || i % 6 === 4,
      };
    });
}

const MONTHS = ['Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct'];

export type BillingSummary = {
  gross30d: number;
  net30d: number;
  activeSubscribers: number;
  toWatch: number;
  monthlyRevenue: { month: string; revenue: number }[];
};

export function getBillingSummary(community: CommunityListItem): BillingSummary {
  const payments = getCommunityPayments(community);
  const subs = getCommunitySubscriptions(community);
  const gross30d = payments
    .filter((p) => p.status === 'PAID' && new Date(p.created_at).getTime() >= TODAY - 30 * 86_400_000)
    .reduce((sum, p) => sum + p.amount, 0);
  return {
    gross30d,
    net30d: Math.round(gross30d * (1 - COMMISSION_RATE)),
    activeSubscribers: subs.filter((s) => s.status === 'active' || s.status === 'trialing').length,
    toWatch: payments.filter((p) => p.status === 'PENDING' || p.status === 'FAILED').length,
    // Ends on the last 30 days, slower growth before (sample scale)
    monthlyRevenue: MONTHS.map((month, i) => ({
      month,
      revenue: i === MONTHS.length - 1 ? gross30d : Math.round((gross30d * (0.5 + i * 0.045)) / 5_000) * 5_000,
    })),
  };
}
