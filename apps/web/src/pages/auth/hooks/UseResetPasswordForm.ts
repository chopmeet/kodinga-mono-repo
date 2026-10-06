import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { useResetUserPasswordMutation } from '@/utils/api/auth/auth.api';
import { parseApiError } from '@/utils/api/errors';

const resetSchema = z
  .object({
    new_password: z
      .string()
      .min(8, 'Au moins 8 caractères')
      .refine((v) => !/^\d+$/.test(v), 'Le mot de passe ne peut pas contenir uniquement des chiffres'),
    confirm_password: z.string().min(1, 'Confirmez votre mot de passe'),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm_password'],
  });

type ResetValues = z.infer<typeof resetSchema>;

function UseResetPasswordForm() {
  // The emailed link is {FRONTEND_URL}/auth/reset-password?token=...
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [resetPassword, { isLoading }] = useResetUserPasswordMutation();
  const [done, setDone] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(token.length < 10);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (values: ResetValues) => {
    setFormError(null);
    try {
      await resetPassword({ token, ...values }).unwrap();
      setDone(true);
    } catch (error) {
      const { code, message, fields } = parseApiError(error);
      if (code === 'invalid_reset_token' || fields.token) {
        setLinkInvalid(true);
        return;
      }
      if (fields.new_password) setError('new_password', { message: fields.new_password });
      if (fields.confirm_password) setError('confirm_password', { message: fields.confirm_password });
      if (!fields.new_password && !fields.confirm_password) setFormError(message);
    }
  };

  return {
    register,
    errors,
    formError,
    isLoading,
    done,
    linkInvalid,
    password: watch('new_password') ?? '',
    onSubmit: handleSubmit(onSubmit),
  };
}

export default UseResetPasswordForm;
