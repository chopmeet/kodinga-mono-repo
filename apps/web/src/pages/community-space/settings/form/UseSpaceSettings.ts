import { useOutletContext } from 'react-router-dom';

import { customToast } from '@kodinga/ui';
import {
  useAddCommunityRuleMutation,
  useDeleteCommunityRuleMutation,
  useGetCommunityQuery,
  useUpdateCommunityMutation,
  useUpdateCommunitySettingsMutation,
} from '@/utils/api/community/community.api';
import type { BillingInterval } from '@/utils/api/billing/billing.type';
import type { CommunityDetail, CommunityListItem, CommunityPrivacy, CommunityRuleItem, CommunitySettings } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

export type PostPermission = CommunitySettings['default_post_permission'];

/** "Informations" tab (PATCH communities/<slug>/) */
export type CommunityProfile = {
  name: string;
  tagline: string;
  description: string;
  category_id: string;
  brand_color: string;
  website_url: string;
  github_url: string;
  discord_url: string;
  twitter_url: string;
};

/** "Accès & publication" tab: privacy on the community, the rest in its settings */
export type CommunityAccess = {
  privacy_type: CommunityPrivacy;
  require_approval_to_join: boolean;
  allow_member_invites: boolean;
  default_post_permission: PostPermission;
  is_read_only: boolean;
  welcome_message: string;
};

export type CommunityRule = CommunityRuleItem;

/** First plan of a community that becomes paid (PATCH communities/<slug>/, Kodinga Pro only) */
export type MembershipInput = { membership_price: number; membership_interval: BillingInterval; membership_plan_name?: string };

const profileOf = (c: CommunityDetail): CommunityProfile => ({
  name: c.name,
  tagline: c.tagline ?? '',
  description: c.description ?? '',
  category_id: c.category?.id ?? '',
  brand_color: /^#[0-9a-fA-F]{6}$/.test(c.brand_color ?? '') ? (c.brand_color as string) : '#1D4ED8',
  website_url: c.website_url ?? '',
  github_url: c.github_url ?? '',
  discord_url: c.discord_url ?? '',
  twitter_url: c.twitter_url ?? '',
});

const accessOf = (c: CommunityDetail): CommunityAccess => ({
  privacy_type: c.privacy_type,
  require_approval_to_join: c.settings?.require_approval_to_join ?? false,
  allow_member_invites: c.settings?.allow_member_invites ?? true,
  default_post_permission: c.settings?.default_post_permission ?? 'all_members',
  is_read_only: c.settings?.is_read_only ?? false,
  welcome_message: c.settings?.welcome_message ?? '',
});

/**
 * Settings of one community, shared by the tabs: read from GET communities/<slug>/ (it carries the
 * settings and the rules), saved with PATCH communities/<slug>/, PATCH .../settings/ and the
 * rules endpoints. Each save returns true when the api accepted it.
 */
function UseSpaceSettings(community: CommunityListItem) {
  const slug = community.slug;
  const { data: detail, isLoading, error } = useGetCommunityQuery(slug);
  const [updateCommunity] = useUpdateCommunityMutation();
  const [updateSettings] = useUpdateCommunitySettingsMutation();
  const [addRule] = useAddCommunityRuleMutation();
  const [deleteRule] = useDeleteCommunityRuleMutation();

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      customToast.success({ message });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  const rules = [...(detail?.rules ?? [])].sort((a, b) => a.order - b.order);
  const nextOrder = rules.reduce((max, r) => Math.max(max, r.order), -1) + 1;

  return {
    isLoading,
    loadError: !detail && error ? parseApiError(error).message : null,
    profile: detail ? profileOf(detail) : null,
    access: detail ? accessOf(detail) : null,
    rules,
    pricingType: detail?.pricing_type ?? community.pricing_type,
    /** The api creates the plan; the space then shows "Abonnements & paiements" */
    makePaid: (input: MembershipInput) =>
      run(() => updateCommunity({ slug, pricing_type: 'paid', ...input }).unwrap(), 'La communauté est maintenant payante.'),
    saveProfile: (values: CommunityProfile) =>
      run(() => updateCommunity({ slug, ...values, category_id: values.category_id || null }).unwrap(), 'Informations de la communauté enregistrées.'),
    saveAccess: ({ privacy_type, ...settings }: CommunityAccess) =>
      run(async () => {
        if (detail && privacy_type !== detail.privacy_type) await updateCommunity({ slug, privacy_type }).unwrap();
        await updateSettings({ slug, ...settings }).unwrap();
      }, 'Règles d’accès enregistrées.'),
    addRule: (values: { title: string; description: string }) => run(() => addRule({ slug, ...values, order: nextOrder }).unwrap(), 'Règle ajoutée.'),
    /** The api cannot update a rule: it is replaced, at the same place */
    editRule: (rule: CommunityRule, values: { title: string; description: string }) =>
      run(async () => {
        await addRule({ slug, ...values, order: rule.order }).unwrap();
        await deleteRule({ slug, ruleId: rule.id }).unwrap();
      }, 'Règle mise à jour.'),
    removeRule: (rule: CommunityRule) => run(() => deleteRule({ slug, ruleId: rule.id }).unwrap(), 'Règle supprimée.'),
  };
}

export type SpaceSettings = ReturnType<typeof UseSpaceSettings>;

/** What the tabs receive: the settings once loaded */
export type ReadySpaceSettings = SpaceSettings & { profile: CommunityProfile; access: CommunityAccess };

export const useSpaceSettings = () => useOutletContext<ReadySpaceSettings>();

export default UseSpaceSettings;
