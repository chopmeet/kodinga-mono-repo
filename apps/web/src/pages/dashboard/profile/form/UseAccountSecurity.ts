import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import { useAppDispatch } from '@/redux/hook';
import { onLogout } from '@/redux/slice/User.slice';
import { AuthApi } from '@/utils/api/auth/auth.api';
import { parseApiError } from '@/utils/api/errors';
import { useChangePasswordMutation, useGetSessionsQuery, useLogoutAllMutation, useRevokeSessionMutation, UserApi } from '@/utils/api/user/user.api';

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Votre mot de passe actuel'),
    new_password: z.string().min(8, '8 caractères au minimum'),
    confirm_password: z.string().min(1, 'Confirmez le nouveau mot de passe'),
  })
  .refine((v) => v.new_password === v.confirm_password, { path: ['confirm_password'], message: 'Les deux mots de passe ne correspondent pas' })
  .refine((v) => v.new_password !== v.current_password, { path: ['new_password'], message: 'Choisissez un mot de passe différent de l’actuel' });

export type PasswordValues = z.infer<typeof passwordSchema>;

/** /dashboard/profile/security — password and the sessions open on other devices */
function UseAccountSecurity() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const sessions = useGetSessionsQuery();
  const [changePassword, { isLoading: isChanging }] = useChangePasswordMutation();
  const [revoke, { isLoading: isRevoking, originalArgs: revokingId }] = useRevokeSessionMutation();
  const [logoutAll, { isLoading: isLoggingOutAll }] = useLogoutAllMutation();

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const submitPassword = form.handleSubmit(async (values) => {
    try {
      await changePassword(values).unwrap();
      form.reset();
      customToast.success({ message: 'Mot de passe modifié.' });
    } catch (error) {
      const parsed = parseApiError(error);
      // The api checks the current password and the strength of the new one
      const fields = Object.entries(parsed.fields).filter(([f]) => f in values);
      fields.forEach(([field, message]) => form.setError(field as keyof PasswordValues, { message }));
      if (!fields.length) customToast.error({ message: parsed.message });
    }
  });

  return {
    form,
    submitPassword,
    isChanging,
    sessions: sessions.data ?? [],
    isLoadingSessions: sessions.isLoading,
    revokingId: isRevoking ? revokingId : undefined,
    revoke: async (id: string) => {
      try {
        await revoke(id).unwrap();
        customToast.success({ message: 'Appareil déconnecté.' });
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
      }
    },
    isLoggingOutAll,
    /** Every device, this one too: back to the login page */
    logoutEverywhere: async () => {
      try {
        await logoutAll().unwrap();
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
        return;
      }
      dispatch(onLogout());
      dispatch(AuthApi.util.resetApiState());
      dispatch(UserApi.util.resetApiState());
      customToast.success({ message: 'Vous êtes déconnecté de tous vos appareils.' });
      navigate('/auth/login', { replace: true });
    },
  };
}

export default UseAccountSecurity;
