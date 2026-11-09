import { CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { InputPassword } from '@kodinga/ui';

import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { PasswordCheck } from './components/password-check';
import { SubmitButton } from './components/submit-button';
import UseResetPasswordForm from './hooks/UseResetPasswordForm';

const linkClassName = 'font-semibold text-brand hover:text-brand-hover hover:underline';

function ResetPassword() {
  const { t } = useTranslation();
  const { 
    register, 
    errors, 
    formError, 
    isLoading, 
    done, 
    linkInvalid, 
    password, 
    onSubmit
  } = UseResetPasswordForm();

  if (done) {
    return (
      <AuthWrapper title={t('auth.reset.doneTitle')}>
        <div className="flex flex-col gap-6">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CircleCheck className="size-6" />
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600">
            {t('auth.reset.done')}
          </p>
          <Link
            to="/auth/login"
            className="flex h-13 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-white shadow-sm hover:bg-brand-hover"
          >
            {t('auth.common.login')}
          </Link>
        </div>
      </AuthWrapper>
    );
  }

  if (linkInvalid) {
    return (
      <AuthWrapper
        title={t('auth.common.invalidLink')}
        footer={
          <Link to="/auth/login" className={linkClassName}>
            {t('auth.common.backToLogin')}
          </Link>
        }
      >
        <div className="flex flex-col gap-5">
          <FormAlert>{t('auth.reset.invalid')}</FormAlert>
          <p className="text-[15px] text-slate-600">
            {t('auth.common.singleUse')}{' '}
            <Link to="/auth/forgot-password" className={linkClassName}>
              {t('auth.reset.newLink')}
            </Link>
          </p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        {formError && <FormAlert>{formError}</FormAlert>}

        <InputPassword
          id="reset-password"
          label={t('auth.reset.newPassword')}
          autoComplete="new-password"
          required
          error={errors.new_password?.message}
          {...register('new_password')}
        />
        {password.length > 0 && (
          <div className="mb-3">
            <PasswordCheck password={password} />
          </div>
        )}

        <InputPassword
          id="reset-password-confirm"
          label={t('auth.reset.confirm')}
          autoComplete="new-password"
          required
          error={errors.confirm_password?.message}
          {...register('confirm_password')}
        />

        <div className="mt-4">
          <SubmitButton isLoading={isLoading}>{t('auth.reset.submit')}</SubmitButton>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default ResetPassword;
