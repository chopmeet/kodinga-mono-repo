// Mock data for the admin "Paramètres" tab. Categories reuse the shape of the api
// CommunityCategory (+ is_active / communities count an admin endpoint would return).
import type { CommunityCategory } from '@/utils/api/community/community.type';
import { adminCategories, adminCommunities } from './admin-communities.data';

export type PlatformSettings = {
  platform_name: string;
  support_email: string;
  default_language: 'fr' | 'en';
  registrations_open: boolean;
  require_email_verification: boolean;
  /** Plugged to the api: community_creation_allowed_for */
  community_creation: 'all' | 'pro_only';
};

export type AdminCategory = CommunityCategory & {
  is_active: boolean;
  communities_count: number;
};

export type PaymentChannel = {
  id: 'orange_money' | 'wave' | 'mtn_momo' | 'moov_money' | 'card';
  label: string;
  enabled: boolean;
};

export type MonetizationSettings = {
  /** Stored by the api (system setting pro_monthly_price) */
  pro_monthly_price: number;
  /** Stored by the api: price of the Pro plans billed yearly and once (billing/plans/<id>/) */
  pro_yearly_price: number;
  pro_lifetime_price: number;
  /** Shown with the yearly Pro plan (its description in billing/plans/) */
  pro_yearly_description: string;
  commission_rate: number;
  min_monthly_price: number;
  currency: 'XOF';
  payout_delay_days: number;
  channels: PaymentChannel[];
};

export const platformSettings: PlatformSettings = {
  platform_name: 'Kodinga',
  support_email: 'support@kodinga.com',
  default_language: 'fr',
  registrations_open: true,
  require_email_verification: true,
  community_creation: 'all',
};

export const settingsCategories: AdminCategory[] = adminCategories.map((c) => ({
  ...c,
  description: c.description || `Communautés ${c.name}`,
  is_active: true,
  communities_count: adminCommunities.filter((community) => community.category?.slug === c.slug).length,
}));

export const monetizationSettings: MonetizationSettings = {
  pro_monthly_price: 5_000,
  pro_yearly_price: 50_000,
  pro_lifetime_price: 150_000,
  pro_yearly_description: '',
  commission_rate: 10,
  min_monthly_price: 2_000,
  currency: 'XOF',
  payout_delay_days: 7,
  channels: [
    { id: 'orange_money', label: 'Orange Money', enabled: true },
    { id: 'wave', label: 'Wave', enabled: true },
    { id: 'mtn_momo', label: 'MTN MoMo', enabled: true },
    { id: 'moov_money', label: 'Moov Money', enabled: true },
    { id: 'card', label: 'Carte bancaire', enabled: false },
  ],
};
