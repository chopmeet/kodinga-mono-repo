import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast, Input } from '@kodinga-mono-repo/ui';
import { useSettings } from '../admin-settings';
import FormActions from '@/pages/shared/form-actions';
import SettingSwitch from '@/pages/shared/setting-switch';

const schema = z
  .object({
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

function MonetizationSettingsTab() {
  const { monetization, saveMonetization } = useSettings();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values, unknown, Parsed>({ resolver: zodResolver(schema), defaultValues: monetization });
  const { fields } = useFieldArray({ control, name: 'channels' });

  const onSubmit = async (values: Parsed) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const next = { ...monetization, ...values, channels: monetization.channels.map((c, i) => ({ ...c, enabled: values.channels[i].enabled })) };
    saveMonetization(next);
    reset(next);
    customToast.success({ message: 'Paramètres de monétisation enregistrés.' });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900">Monétisation</h2>
      <p className="mb-5 text-sm text-slate-500">Commission de la plateforme et paiements des communautés payantes (PayDunya).</p>

      <div className="grid gap-x-4 md:grid-cols-3">
        <Input
          id="commission_rate"
          type="number"
          step="0.5"
          label="Commission plateforme (%)"
          required
          fieldHelp="Prélevée sur chaque abonnement."
          error={errors.commission_rate?.message}
          {...register('commission_rate')}
        />
        <Input
          id="min_monthly_price"
          type="number"
          label="Prix mensuel minimum (FCFA)"
          required
          error={errors.min_monthly_price?.message}
          {...register('min_monthly_price')}
        />
        <Input
          id="payout_delay_days"
          type="number"
          label="Délai de reversement (jours)"
          required
          fieldHelp="Avant reversement aux créateurs."
          error={errors.payout_delay_days?.message}
          {...register('payout_delay_days')}
        />
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Devise : <span className="font-medium text-slate-900">Franc CFA (XOF)</span>
      </p>

      <fieldset className="border-t border-slate-100 pt-3">
        <legend className="pt-3 text-sm font-semibold text-slate-900">Moyens de paiement</legend>
        <div className="divide-y divide-slate-100">
          {fields.map((channel, index) => (
            <Controller
              key={channel.id}
              control={control}
              name={`channels.${index}.enabled`}
              render={({ field }) => (
                <SettingSwitch label={channel.label} checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          ))}
        </div>
        {errors.channels?.root?.message || errors.channels?.message ? (
          <p role="alert" className="mt-2 text-sm text-red-600">{errors.channels?.root?.message ?? errors.channels?.message}</p>
        ) : null}
      </fieldset>

      <FormActions isDirty={isDirty} isSaving={isSubmitting} onReset={() => reset(monetization)} />
    </form>
  );
}

export default MonetizationSettingsTab;
