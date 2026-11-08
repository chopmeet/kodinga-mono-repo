import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { SelectInput, TextareaInput } from '@kodinga-mono-repo/ui';
import FormActions from '@/pages/shared/form-actions';
import SettingSwitch from '@/pages/shared/setting-switch';
import PaidAccessCard from '../components/paid-access-card';
import { useSpaceSettings } from '../form/UseSpaceSettings';

const schema = z.object({
  privacy_type: z.enum(['public', 'private', 'secret']),
  require_approval_to_join: z.boolean(),
  allow_member_invites: z.boolean(),
  default_post_permission: z.enum(['all_members', 'moderators_only', 'admins_only']),
  is_read_only: z.boolean(),
  welcome_message: z.string().trim().max(500, '500 caractères maximum'),
});

type Values = z.infer<typeof schema>;

const privacyHelp: Record<Values['privacy_type'], string> = {
  public: "Visible dans l'annuaire, le contenu est lisible par tous.",
  private: "Visible dans l'annuaire, le contenu est réservé aux membres.",
  secret: "Absente de l'annuaire et de la recherche : on n'y entre que sur invitation.",
};

function AccessTab() {
  const { access, saveAccess, pricingType } = useSpaceSettings();
  // A paid community is private or secret (rule of the api)
  const paid = pricingType === 'paid';
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { ...access, is_read_only: access.is_read_only ?? false } });

  const onSubmit = async (values: Values) => {
    // The api would make it private without a word: the choice is asked here
    if (paid && values.privacy_type === 'public') return setError('privacy_type', { message: 'Une communauté payante ne peut pas être publique : choisissez Privée ou Secrète.' });
    if (await saveAccess(values)) reset(values);
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <h2 className="text-lg font-semibold text-slate-900">Accès & publication</h2>
        <p className="mb-5 text-sm text-slate-500">Qui peut voir, rejoindre et publier dans la communauté.</p>

        <div className="grid gap-x-4 md:grid-cols-2">
          <SelectInput
            label="Visibilité"
            fieldHelp={paid ? `Communauté payante : privée ou secrète. ${privacyHelp[watch('privacy_type')]}` : privacyHelp[watch('privacy_type')]}
            error={errors.privacy_type?.message}
            options={[
              // Paid: public only for a community still public from before the rule, to change
              ...(!paid || access.privacy_type === 'public' ? [{ value: 'public', label: paid ? 'Publique (non autorisée, communauté payante)' : 'Publique' }] : []),
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
            name="is_read_only"
            render={({ field }) => (
              <SettingSwitch
                label="Mode lecture seule"
                description="Les membres ordinaires peuvent seulement lire les discussions et messages sans pouvoir écrire."
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
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

        <FormActions isDirty={isDirty} isSaving={isSubmitting} onReset={() => reset({ ...access, is_read_only: access.is_read_only ?? false })} />
      </form>
      {/* Its own form: not part of the save of the access rules */}
      <PaidAccessCard />
    </>
  );
}

export default AccessTab;
