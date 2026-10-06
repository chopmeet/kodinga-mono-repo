import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { useAppDispatch } from '@/redux/hook';
import { onSetUserToken } from '@/redux/slice/User.slice';
import { useLoginUserMutation } from '@/utils/api/auth/auth.api';
import { parseApiError } from '@/utils/api/errors';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Saisissez votre email').email('Adresse email invalide'),
  password: z.string().min(1, 'Saisissez votre mot de passe'),
});

type LoginValues = z.infer<typeof loginSchema>;

/** Only same-app paths: "?next=https://evil.com" or "//evil.com" must not redirect away */
const safeNext = (next: string | null) => (next?.startsWith('/') && !next.startsWith('//') ? next : '/');

function UseLoginForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [loginUser, { isLoading }] = useLoginUserMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    try {
      const result = await loginUser({ ...values, email: values.email.toLowerCase() }).unwrap();
      dispatch(onSetUserToken({ user: result.user, token: result.access, refresh: result.refresh }));
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (error) {
      const { message, fields } = parseApiError(error);
      if (fields.email) setError('email', { message: fields.email });
      if (fields.password) setError('password', { message: fields.password });
      if (!fields.email && !fields.password) setFormError(message);
    }
  };

  return {
    register,
    errors,
    formError,
    onSubmit: handleSubmit(onSubmit),
    isLoading,
  };
}

export default UseLoginForm;
