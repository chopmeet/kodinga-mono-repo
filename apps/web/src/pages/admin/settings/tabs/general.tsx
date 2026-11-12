import { Controller } from 'react-hook-form';

import { Input, SelectInput } from '@kodinga/ui';
import FormActions from '@/pages/shared/form-actions';
import SettingSwitch from '@/pages/shared/setting-switch';
import UseManageSystemSettings from '../form/UseManageSystemSettings';

function GeneralSettingsTab() {
  const { 
    register, 
    control, 
    errors, 
    isDirty, 
    isSubmitting, 
    settingsLoading, 
    onSubmit, 
    onReset, 
  } = UseManageSystemSettings();

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 className="text-lg font-semibold text-foreground">Général</h2>
      <p className="text-sm text-muted-foreground">Identité de la plateforme et règles d'inscription.</p>
      <p className="mt-2 mb-5 rounded-lg bg-subtle px-3 py-2 text-xs text-muted-foreground">
        Seule la « Création de communautés » est enregistrée sur la plateforme pour l'instant ; les autres réglages restent locaux.
      </p>

      <div className="grid gap-x-4 md:grid-cols-2">
        <Input id="platform_name" label="Nom de la plateforme" required error={errors.platform_name?.message} {...register('platform_name')} />
        <Input
          id="support_email"
          type="email"
          label="Email de support"
          required
          fieldHelp="Affiché dans les emails et les pages d'aide."
          error={errors.support_email?.message}
          {...register('support_email')}
        />
        <SelectInput
          label="Langue par défaut"
          options={[
            { label: 'Français', value: 'fr' },
            { label: 'English', value: 'en' },
          ]}
          {...register('default_language')}
        />
        <SelectInput
          label="Création de communautés"
          fieldHelp={settingsLoading ? 'Chargement du réglage…' : 'Appliqué par la plateforme à chaque création de communauté.'}
          disabled={settingsLoading}
          options={[
            { label: 'Tous les membres (Hobby & Pro)', value: 'all' },
            { label: 'Abonnés Pro uniquement (5 000 FCFA/mois)', value: 'pro_only' },
          ]}
          {...register('community_creation')}
        />
      </div>

      <div className="mt-2 divide-y divide-border-soft border-t border-border-soft">
        <Controller
          control={control}
          name="registrations_open"
          render={({ field }) => (
            <SettingSwitch
              label="Inscriptions ouvertes"
              description="Désactivez pour suspendre temporairement les nouvelles inscriptions."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="require_email_verification"
          render={({ field }) => (
            <SettingSwitch
              label="Vérification de l'email obligatoire"
              description="Les nouveaux comptes doivent confirmer leur email avant de publier."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>

      <FormActions isDirty={isDirty} isSaving={isSubmitting} onReset={onReset} />
    </form>
  );
}

export default GeneralSettingsTab;
