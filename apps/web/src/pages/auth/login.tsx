import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { Button, Input, InputPassword } from '@kodinga/ui';

import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { EmailSeparator, OAuthButtons } from './components/oauth-buttons';
import UseLoginForm from './hooks/UseLoginForm';
import { GoKey } from "react-icons/go";


function Login() {
  const { t } = useTranslation();
  const { 
    register, 
    errors, 
    formError, 
    onSubmit, 
    isLoading 
  } = UseLoginForm();
  const [params] = useSearchParams();
  const next = params.get('next');

  return (
    <AuthWrapper
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          <p className="mb-4 text-[15px]">
            {t('auth.login.noAccount')}{' '}
            <Link to={next ? `/auth/register?next=${encodeURIComponent(next)}` : '/auth/register'} className="font-semibold text-brand hover:text-brand-hover hover:underline">
              {t('auth.login.signup')}
            </Link>
          </p>
          {t('auth.login.terms')}
          <br />
          {t('auth.login.privacy')}
        </>
      }
    >
      <OAuthButtons />
      <EmailSeparator />

      <form onSubmit={onSubmit} noValidate>
        <div className="form-content flex flex-col gap-2">
          {formError && <FormAlert>{formError}</FormAlert>}

          <Input
            id="__login_email"
            label={t('auth.common.email')}
            type="email"
            icon={<Mail className="size-4" />}
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />

          <div>
            <InputPassword
              id="__login_password"
              label={t('auth.common.password')}
              autoComplete="current-password"
              icon={<GoKey />}
              required
              error={errors.password?.message}
              {...register('password')}
            />
            <div className="mt-2 text-right">
              <Link
                to="/auth/forgot-password"
                className="text-sm font-semibold text-brand hover:text-brand-hover hover:underline"
              >
                {t('auth.login.forgot')}
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <Button type="submit" className="w-full rounded-xl" isLoading={isLoading}>
              {t('auth.login.submit')}
            </Button>
          </div>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default Login;
