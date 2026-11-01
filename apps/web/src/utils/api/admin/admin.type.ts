// Mirrors apps/administration (models/setting.py, serializers/audit.py SystemSettingSerializer)

/** Key/value platform setting; `is_public` ones are also served by GET system/settings/public/ */
export type SystemSetting = {
  key: string;
  value: unknown;
  description: string;
  is_public: boolean;
};

export type SystemSettingWrite = Pick<SystemSetting, 'key' | 'value'> & Partial<Pick<SystemSetting, 'description' | 'is_public'>>;

/** Who may create a community, read by the api on creation (community_service.py) */
export type CommunityCreationTier = 'all' | 'pro_only';

export const COMMUNITY_CREATION_KEY = 'community_creation_allowed_for';

/** Monthly price of Kodinga Pro, in FCFA: the api keeps the "kodinga-pro-monthly" plan in sync */
export const PRO_MONTHLY_PRICE_KEY = 'pro_monthly_price';
