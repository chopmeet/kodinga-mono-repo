import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useRegisterUserMutation, useResendVerificationMutation } from '@/utils/api/auth/auth.api';
import { parseApiError } from '@/utils/api/errors';

// Same limits as the api RegisterSerializer; the server stays the source of truth
const registerSchema = (t: TFunction) =>
  z.object({
    first_name: z.string().trim().min(1, t('auth.validation.firstNameRequired')).max(150, t('auth.validation.max150')),
    last_name: z.string().trim().min(1, t('auth.validation.lastNameRequired')).max(150, t('auth.validation.max150')),
    username: z
      .string()
      .trim()
      .min(3, t('auth.validation.min3'))
      .max(50, t('auth.validation.max50'))
      .regex(/^[a-zA-Z0-9_-]+$/, t('auth.validation.usernameChars')),
    email: z.string().trim().min(1, t('auth.validation.emailRequired')).email(t('auth.validation.emailInvalid')),
    password: z
      .string()
      .min(8, t('auth.validation.min8'))
      .refine((v) => !/^\d+$/.test(v), t('auth.validation.passwordNumeric')),
    terms_accepted: z.boolean().refine((v) => v, t('auth.validation.termsRequired')),
  });

type RegisterValues = z.infer<ReturnType<typeof registerSchema>>;

const FIELDS = ['first_name', 'last_name', 'username', 'email', 'password', 'terms_accepted'] as const;

/** "Aïcha Ndiaye" -> "aicha_ndiaye": a username suggestion, until the user types their own */
export const suggestUsername = (first: string, last: string) =>
  [first, last]
    .map((part) =>
      part
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
    )
    .filter(Boolean)
    .join('_')
    .slice(0, 50);

function UseRegisterForm() {
  const { t, i18n } = useTranslation();
  const [registerUser, { isLoading }] = useRegisterUserMutation();
  const [resendVerification, { isLoading: isResending }] = useResendVerificationMutation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema(t)),
    defaultValues: { first_name: '', last_name: '', username: '', email: '', password: '', terms_accepted: false },
  });
  const { register, handleSubmit, setError, setValue, watch, getFieldState, formState } = form;

  // Suggest a username from the name while the field has not been edited by hand
  const syncUsername = () => {
    if (getFieldState('username').isDirty) return;
    setValue('username', suggestUsername(form.getValues('first_name'), form.getValues('last_name')));
  };

  const onSubmit = async (values: RegisterValues) => {
    setFormError(null);
    const email = values.email.toLowerCase();
    try {
      await registerUser({
        ...values,
        email,
        username: values.username.toLowerCase(),
        preferred_language: i18n.language?.startsWith('en') ? 'en' : 'fr',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }).unwrap();
      setSentTo(email);
    } catch (error) {
      const { message, fields } = parseApiError(error);
      let onField = false;
      for (const field of FIELDS) {
        if (fields[field]) {
          setError(field, { message: fields[field] });
          onField = true;
        }
      }
      if (!onField) setFormError(message);
    }
  };

  const resend = async () => {
    if (!sentTo) return;
    setFormError(null);
    try {
      await resendVerification({ email: sentTo }).unwrap();
      setResent(true);
    } catch (error) {
      setFormError(parseApiError(error).message);
    }
  };

  return {
    register,
    errors: formState.errors,
    formError,
    isLoading,
    password: watch('password') ?? '',
    syncUsername,
    onSubmit: handleSubmit(onSubmit),
    sentTo,
    resend,
    isResending,
    resent,
    changeEmail: () => {
      setSentTo(null);
      setResent(false);
    },
  };
}

export default UseRegisterForm;
