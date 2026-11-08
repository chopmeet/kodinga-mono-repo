import { Controller } from 'react-hook-form';

import { Input } from '@kodinga/ui';
import FormActions from '@/pages/shared/form-actions';
import SettingSwitch from '@/pages/shared/setting-switch';
import UseMonetizationSettings from '../form/UseMonetizationSettings';

function MonetizationSettingsTab() {
  const { register, control, errors, fields, isDirty, isSubmitting, priceLoading, onSubmit, onReset } = UseMonetizationSettings();

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 className="text-lg font-semibold text-slate-900">Monétisation</h2>
      <p className="mb-5 text-sm text-slate-500">Prix de Kodinga Pro, commission de la plateforme et paiements des communautés payantes (PayDunya).</p>

      <div className="grid gap-x-4 md:grid-cols-3">
        <Input
          id="pro_monthly_price"
          type="number"
          step={500}
          label="Kodinga Pro, prix mensuel (FCFA)"
          required
          disabled={priceLoading}
          fieldHelp="Appliqué aux prochains abonnements Pro."
          error={errors.pro_monthly_price?.message}
          {...register('pro_monthly_price')}
        />
      </div>

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

      <FormActions isDirty={isDirty} isSaving={isSubmitting} onReset={onReset} />
    </form>
  );
}

export default MonetizationSettingsTab;
