import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast, Input, SelectInput } from '@kodinga-mono-repo/ui';
import { useSettings } from '../admin-settings';
import FormActions from '@/pages/shared/form-actions';
import SettingSwitch from '@/pages/shared/setting-switch';

const schema = z.object({
  platform_name: z.string().trim().min(2, 'Au moins 2 caractères'),
  support_email: z.string().trim().min(1, "Saisissez l'email de support").email('Adresse email invalide'),
  default_language: z.enum(['fr', 'en']),
  registrations_open: z.boolean(),
  require_email_verification: z.boolean(),
  community_creation: z.enum(['everyone', 'verified', 'approval']),
});

type Values = z.infer<typeof schema>;

function GeneralSettingsTab() {
  const { general, saveGeneral } = useSettings();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: general });

  const onSubmit = async (values: Values) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    saveGeneral(values);
    reset(values);
    customToast.success({ message: 'Paramètres généraux enregistrés.' });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900">Général</h2>
      <p className="mb-5 text-sm text-slate-500">Identité de la plateforme et règles d'inscription.</p>

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
          fieldHelp="Qui peut ouvrir une nouvelle communauté."
          options={[
            { label: 'Tous les membres', value: 'everyone' },
            { label: 'Membres avec email vérifié', value: 'verified' },
            { label: 'Sur validation d’un administrateur', value: 'approval' },
          ]}
          {...register('community_creation')}
        />
      </div>

      <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
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

      <FormActions isDirty={isDirty} isSaving={isSubmitting} onReset={() => reset(general)} />
    </form>
  );
}

export default GeneralSettingsTab;
