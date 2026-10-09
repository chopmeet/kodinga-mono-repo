import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast, SelectInput, TextareaInput } from '@kodinga-mono-repo/ui';
import FormActions from '@/pages/shared/form-actions';
import SettingSwitch from '@/pages/shared/setting-switch';
import { useSpaceSettings } from '../form/UseSpaceSettings';

const schema = z.object({
  privacy_type: z.enum(['public', 'private', 'secret']),
  require_approval_to_join: z.boolean(),
  allow_member_invites: z.boolean(),
  default_post_permission: z.enum(['all_members', 'moderators_only', 'admins_only']),
  welcome_message: z.string().trim().max(500, '500 caractères maximum'),
});

type Values = z.infer<typeof schema>;

const privacyHelp: Record<Values['privacy_type'], string> = {
  public: "Visible dans l'annuaire, le contenu est lisible par tous.",
  private: "Visible dans l'annuaire, le contenu est réservé aux membres.",
  secret: "Absente de l'annuaire et de la recherche : on n'y entre que sur invitation.",
};

function AccessTab() {
  const { access, saveAccess } = useSpaceSettings();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: access });

  const onSubmit = async (values: Values) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    saveAccess(values);
    reset(values);
    customToast.success({ message: 'Règles d’accès enregistrées.' });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-slate-900">Accès & publication</h2>
      <p className="mb-5 text-sm text-slate-500">Qui peut voir, rejoindre et publier dans la communauté.</p>

      <div className="grid gap-x-4 md:grid-cols-2">
        <SelectInput
          label="Visibilité"
          fieldHelp={privacyHelp[watch('privacy_type')]}
          options={[
            { value: 'public', label: 'Publique' },
            { value: 'private', label: 'Privée' },
            { value: 'secret', label: 'Secrète' },
          ]}
          {...register('privacy_type')}
        />
        <SelectInput
          label="Qui peut publier"
          options={[
            { value: 'all_members', label: 'Tous les membres' },
            { value: 'moderators_only', label: 'Modérateurs et administrateurs' },
            { value: 'admins_only', label: 'Administrateurs uniquement' },
          ]}
          {...register('default_post_permission')}
        />
      </div>

      <div className="mt-2 divide-y divide-slate-100 border-y border-slate-100">
        <Controller
          control={control}
          name="require_approval_to_join"
          render={({ field }) => (
            <SettingSwitch
              label="Valider les demandes d'adhésion"
              description="Les nouvelles demandes arrivent dans Membres > En attente."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="allow_member_invites"
          render={({ field }) => (
            <SettingSwitch
              label="Les membres peuvent inviter"
              description="Sinon, seule l'équipe de la communauté envoie des invitations."
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>

      <TextareaInput
        id="community-welcome"
        label="Message de bienvenue"
        rows={3}
        fieldHelp="Envoyé à chaque nouveau membre."
        customClassContainer="mt-5"
        error={errors.welcome_message?.message}
        {...register('welcome_message')}
      />

      <FormActions isDirty={isDirty} isSaving={isSubmitting} onReset={() => reset(access)} />
    </form>
  );
}

export default AccessTab;
