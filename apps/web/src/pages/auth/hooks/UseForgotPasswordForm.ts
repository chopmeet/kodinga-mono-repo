import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useForgotPasswordMutation } from '@/utils/api/auth/auth.api';
import { parseApiError } from '@/utils/api/errors';

const forgotSchema = (t: TFunction) =>
  z.object({
    email: z.string().trim().min(1, t('auth.validation.emailRequired')).email(t('auth.validation.emailInvalid')),
  });

type ForgotValues = z.infer<ReturnType<typeof forgotSchema>>;

function UseForgotPasswordForm() {
  const { t } = useTranslation();
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  // The api never says whether the account exists: once sent, we just show the confirmation
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema(t)) });

  const send = async (email: string) => {
    setFormError(null);
    try {
      await forgotPassword({ email: email.toLowerCase() }).unwrap();
      setSentTo(email.toLowerCase());
    } catch (error) {
      const { message, fields } = parseApiError(error);
      if (fields.email) setError('email', { message: fields.email });
      else setFormError(message);
    }
  };

  return {
    register,
    errors,
    formError,
    sentTo,
    isLoading,
    onSubmit: handleSubmit(({ email }) => send(email)),
    resend: () => send(sentTo ?? getValues('email')),
    reset: () => setSentTo(null),
  };
}

export default UseForgotPasswordForm;
