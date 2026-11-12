import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import { xof } from '@/utils/Utils';
import { useGetSystemSettingsQuery, useUpdateSystemSettingMutation } from '@/utils/api/admin/admin.api';
import { PRO_MONTHLY_PRICE_KEY } from '@/utils/api/admin/admin.type';
import type { CommunityPlan } from '@/utils/api/billing/billing.type';
import { useGetProPlansQuery, useUpdatePlanMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { useSettings } from '../admin-settings';

const schema = z
  .object({
    pro_monthly_price: z.coerce.number({ message: 'Saisissez un montant' }).int('Montant entier').positive('Montant strictement positif'),
    pro_yearly_price: z.coerce.number({ message: 'Saisissez un montant' }).int('Montant entier').positive('Montant strictement positif'),
    pro_lifetime_price: z.coerce.number({ message: 'Saisissez un montant' }).int('Montant entier').positive('Montant strictement positif'),
    pro_yearly_description: z.string().trim().max(500, '500 caractères au plus'),
    commission_rate: z.coerce.number().min(0, 'Minimum 0 %').max(30, 'Maximum 30 %'),
    min_monthly_price: z.coerce.number().int('Montant entier').min(500, 'Minimum 500 FCFA'),
    payout_delay_days: z.coerce.number().int('Nombre de jours entier').min(0).max(30, 'Maximum 30 jours'),
    currency: z.literal('XOF'),
    channels: z.array(z.object({ id: z.string(), label: z.string(), enabled: z.boolean() })),
  })
  .refine((v) => v.channels.some((c) => c.enabled), {
    message: 'Gardez au moins un moyen de paiement actif.',
    path: ['channels'],
  });

type Values = z.input<typeof schema>;
type Parsed = z.output<typeof schema>;

/** The api stores a number, or { amount | price | value } (BillingService.parse_price_value reads both) */
const toPrice = (value: unknown): number | undefined => {
  const raw = value && typeof value === 'object' ? ((value as Record<string, unknown>).amount ?? (value as Record<string, unknown>).price ?? (value as Record<string, unknown>).value) : value;
  const price = Number(raw);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : undefined;
};

/** Global Pro plan (no community) billed with this interval; none when the api does not list it */
const proPlan = (plans: unknown, interval: CommunityPlan['billing_interval']) =>
  (Array.isArray(plans) ? (plans as CommunityPlan[]) : []).find((p) => !p.community_id && p.billing_interval === interval && Number(p.price) > 0);

/**
 * Monetization settings. The api stores the Kodinga Pro prices: monthly in the system setting
 * pro_monthly_price (synced with the monthly plan), yearly and lifetime on their plans
 * (billing/plans/<id>/, superadmin). The other fields stay local for now.
 */
function UseMonetizationSettings() {
  const { monetization, saveMonetization } = useSettings();
  const {
    register,
    control,
    handleSubmit,
    reset,
    resetField,
    setValue,
    getValues,
    getFieldState,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<Values, unknown, Parsed>({ resolver: zodResolver(schema), defaultValues: monetization });
  const { fields } = useFieldArray({ control, name: 'channels' });

  const { data: settings, isLoading: settingsLoading } = useGetSystemSettingsQuery();
  const [updateSetting] = useUpdateSystemSettingMutation();
  const storedPrice = settings ? toPrice(settings.find((s) => s.key === PRO_MONTHLY_PRICE_KEY)?.value) : undefined;

  const { data: plans, isLoading: plansLoading } = useGetProPlansQuery();
  const [updatePlan] = useUpdatePlanMutation();
  const yearly = proPlan(plans, 'year');
  const lifetime = proPlan(plans, 'one_time');
  const storedYearly = yearly ? toPrice(yearly.price) : undefined;
  const storedLifetime = lifetime ? toPrice(lifetime.price) : undefined;
  const storedDescription = yearly?.description;

  // The api value replaces the default once loaded (unless the field is being edited)
  useEffect(() => {
    if (storedPrice !== undefined && !dirtyFields.pro_monthly_price) {
      reset({ ...getValues(), pro_monthly_price: storedPrice }, { keepDirtyValues: true });
    }
  }, [storedPrice, dirtyFields.pro_monthly_price, reset, getValues]);
  // Field by field: a reset of the whole form would make an edit in progress its new default
  useEffect(() => {
    if (storedYearly !== undefined && !getFieldState('pro_yearly_price').isDirty) resetField('pro_yearly_price', { defaultValue: storedYearly });
  }, [storedYearly, getFieldState, resetField]);
  useEffect(() => {
    if (storedLifetime !== undefined && !getFieldState('pro_lifetime_price').isDirty) resetField('pro_lifetime_price', { defaultValue: storedLifetime });
  }, [storedLifetime, getFieldState, resetField]);
  useEffect(() => {
    if (storedDescription !== undefined && !getFieldState('pro_yearly_description').isDirty) {
      resetField('pro_yearly_description', { defaultValue: storedDescription });
    }
  }, [storedDescription, getFieldState, resetField]);

  // What a year costs on the monthly plan, against the yearly one
  const [monthly, yearlyValue] = useWatch({ control, name: ['pro_monthly_price', 'pro_yearly_price'] });
  const yearlySaving = Number(monthly) * 12 - Number(yearlyValue);
  // The description of the yearly plan, rewritten from the prices on the form
  const yearlySuggestion =
    yearlySaving > 0
      ? `Formule Pro annuelle : ${xof(Number(yearlyValue))} par an au lieu de ${xof(Number(monthly) * 12)}, soit ${xof(yearlySaving)} d’économie.`
      : `Formule Pro annuelle : ${xof(Number(yearlyValue))} par an.`;

  const onSubmit = async (values: Parsed) => {
    // Sent only when edited (and different from the stored value)
    if (dirtyFields.pro_monthly_price && values.pro_monthly_price !== storedPrice) {
      try {
        await updateSetting({
          key: PRO_MONTHLY_PRICE_KEY,
          value: values.pro_monthly_price,
          description: "Montant mensuel de l'abonnement Kodinga Pro (en XOF / FCFA), modifiable par le superadmin.",
          // Public like in the seed: the pricing pages read it without being admin
          is_public: true,
        }).unwrap();
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
        return;
      }
    }
    // Yearly and lifetime: their own Pro plan, only when edited (and different from the stored price)
    // Price and description of the yearly plan go in one request
    const planChanges = [
      {
        plan: yearly,
        body: {
          ...(dirtyFields.pro_yearly_price && values.pro_yearly_price !== storedYearly ? { price: values.pro_yearly_price } : {}),
          ...(dirtyFields.pro_yearly_description && values.pro_yearly_description !== storedDescription ? { description: values.pro_yearly_description } : {}),
        },
      },
      { plan: lifetime, body: dirtyFields.pro_lifetime_price && values.pro_lifetime_price !== storedLifetime ? { price: values.pro_lifetime_price } : {} },
    ];
    for (const { plan, body } of planChanges) {
      if (!plan || Object.keys(body).length === 0) continue;
      try {
        await updatePlan({ planId: plan.id, ...body }).unwrap();
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
        return;
      }
    }
    // The other fields are not stored by the api yet
    const next = { ...monetization, ...values, channels: monetization.channels.map((c, i) => ({ ...c, enabled: values.channels[i].enabled })) };
    saveMonetization(next);
    reset(next);
    customToast.success({ message: 'Paramètres de monétisation enregistrés.' });
  };

  return {
    register,
    control,
    errors,
    fields,
    isDirty,
    isSubmitting,
    priceLoading: settingsLoading,
    plansLoading,
    /** false when the api lists no such Pro plan: the field cannot be saved */
    hasYearly: !!yearly,
    hasLifetime: !!lifetime,
    yearlySaving,
    yearlySuggestion,
    /** Puts the suggested description in the field (still to be saved) */
    applyYearlySuggestion: () => setValue('pro_yearly_description', yearlySuggestion, { shouldDirty: true, shouldValidate: true }),
    onSubmit: handleSubmit(onSubmit),
    onReset: () =>
      reset({
        ...monetization,
        ...(storedPrice !== undefined ? { pro_monthly_price: storedPrice } : {}),
        ...(storedYearly !== undefined ? { pro_yearly_price: storedYearly } : {}),
        ...(storedLifetime !== undefined ? { pro_lifetime_price: storedLifetime } : {}),
        ...(storedDescription !== undefined ? { pro_yearly_description: storedDescription } : {}),
      }),
  };
}

export default UseMonetizationSettings;
