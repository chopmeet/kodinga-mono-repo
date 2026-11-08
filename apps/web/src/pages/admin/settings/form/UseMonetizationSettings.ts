import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import { useGetSystemSettingsQuery, useUpdateSystemSettingMutation } from '@/utils/api/admin/admin.api';
import { PRO_MONTHLY_PRICE_KEY } from '@/utils/api/admin/admin.type';
import { parseApiError } from '@/utils/api/errors';
import { useSettings } from '../admin-settings';

const schema = z
  .object({
    pro_monthly_price: z.coerce.number({ message: 'Saisissez un montant' }).int('Montant entier').positive('Montant strictement positif'),
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

/**
 * Monetization settings. Only the Kodinga Pro monthly price is stored by the api (system setting
 * pro_monthly_price, synced with the Pro plan); the other fields stay local for now.
 */
function UseMonetizationSettings() {
  const { monetization, saveMonetization } = useSettings();
  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<Values, unknown, Parsed>({ resolver: zodResolver(schema), defaultValues: monetization });
  const { fields } = useFieldArray({ control, name: 'channels' });

  const { data: settings, isLoading: settingsLoading } = useGetSystemSettingsQuery();
  const [updateSetting] = useUpdateSystemSettingMutation();
  const storedPrice = settings ? toPrice(settings.find((s) => s.key === PRO_MONTHLY_PRICE_KEY)?.value) : undefined;

  // The api value replaces the default once loaded (unless the field is being edited)
  useEffect(() => {
    if (storedPrice !== undefined && !dirtyFields.pro_monthly_price) {
      reset({ ...getValues(), pro_monthly_price: storedPrice }, { keepDirtyValues: true });
    }
  }, [storedPrice, dirtyFields.pro_monthly_price, reset, getValues]);

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
    onSubmit: handleSubmit(onSubmit),
    onReset: () => reset({ ...monetization, ...(storedPrice !== undefined ? { pro_monthly_price: storedPrice } : {}) }),
  };
}

export default UseMonetizationSettings;
