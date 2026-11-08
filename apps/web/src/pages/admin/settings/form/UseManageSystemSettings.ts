import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import { useGetSystemSettingsQuery, useUpdateSystemSettingMutation } from '@/utils/api/admin/admin.api';
import { COMMUNITY_CREATION_KEY, type CommunityCreationTier } from '@/utils/api/admin/admin.type';
import { parseApiError } from '@/utils/api/errors';
import { useSettings } from '../admin-settings';

const schema = z.object({
  platform_name: z.string().trim().min(2, 'Au moins 2 caractères'),
  support_email: z.string().trim().min(1, "Saisissez l'email de support").email('Adresse email invalide'),
  default_language: z.enum(['fr', 'en']),
  registrations_open: z.boolean(),
  require_email_verification: z.boolean(),
  community_creation: z.enum(['all', 'pro_only']),
});

type Values = z.infer<typeof schema>;

/** The api stores either "all" / "pro_only" or { tier } (community_service.py reads both) */
const toTier = (value: unknown): CommunityCreationTier => {
  const raw = value && typeof value === 'object' ? (value as { tier?: unknown }).tier : value;
  return String(raw).toLowerCase() === 'pro_only' ? 'pro_only' : 'all';
};

/**
 * General settings form. Only "community_creation" is stored by the api
 * (system setting community_creation_allowed_for); the other fields stay local for now.
 */
function UseManageSystemSettings() {
  const { general, saveGeneral } = useSettings();
  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: general });

  const { data: settings, isLoading: settingsLoading } = useGetSystemSettingsQuery();
  const [updateSetting] = useUpdateSystemSettingMutation();
  const storedTier = settings ? toTier(settings.find((s) => s.key === COMMUNITY_CREATION_KEY)?.value ?? 'all') : undefined;

  // The api value replaces the default once loaded (unless the field is being edited)
  useEffect(() => {
    if (storedTier && !dirtyFields.community_creation) {
      reset({ ...getValues(), community_creation: storedTier }, { keepDirtyValues: true });
    }
  }, [storedTier, dirtyFields.community_creation, reset, getValues]);

  const onSubmit = async (values: Values) => {
    // Sent only when edited (and different from the stored value)
    if (dirtyFields.community_creation && values.community_creation !== storedTier) {
      try {
        await updateSetting({
          key: COMMUNITY_CREATION_KEY,
          value: values.community_creation,
          description: "Qui peut créer une communauté ('all' pour Hobby et Pro, 'pro_only' pour Pro uniquement).",
          // Public like in the seed: the creation flow may read it without being admin
          is_public: true,
        }).unwrap();
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
        return;
      }
    }
    // The other fields are not stored by the api yet
    saveGeneral(values);
    reset(values);
    customToast.success({ message: 'Paramètres généraux enregistrés.' });
  };

  return {
    register,
    control,
    errors,
    isDirty,
    isSubmitting,
    settingsLoading,
    onSubmit: handleSubmit(onSubmit),
    // Cancel: back to the saved values, with the community creation stored by the api
    onReset: () => reset({ ...general, ...(storedTier ? { community_creation: storedTier } : {}) }),
  };
}

export default UseManageSystemSettings;
