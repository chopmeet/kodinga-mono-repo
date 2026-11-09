import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Input } from '@kodinga/ui';

import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { SubmitButton } from './components/submit-button';
import UseForgotPasswordForm from './hooks/UseForgotPasswordForm';

function BackToLogin() {
  const { t } = useTranslation();
  return (
    <Link to="/auth/login" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:text-brand-hover hover:underline">
      <ArrowLeft className="size-4" />
      {t('auth.common.backToLogin')}
    </Link>
  );
}

function ForgotPassword() {
  const { t } = useTranslation();
  const { 
    register, 
    errors, 
    formError, 
    sentTo, 
    isLoading, 
    onSubmit, 
    resend, 
    reset 
  } = UseForgotPasswordForm();

  if (sentTo) {
    return (
      <AuthWrapper title={t('auth.common.checkEmails')} footer={<BackToLogin />}>
        <div className="flex flex-col gap-5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <MailCheck className="size-6" />
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600">
            {t('auth.forgot.sentBefore')} <strong className="font-semibold text-slate-900">{sentTo}</strong>
            {t('auth.forgot.sentAfter')}
          </p>
          {formError && <FormAlert>{formError}</FormAlert>}
          <p className="text-sm text-slate-500">
            {t('auth.common.nothingReceived')}{' '}
            <button
              type="button"
              onClick={resend}
              disabled={isLoading}
              className="font-semibold text-brand hover:text-brand-hover hover:underline disabled:opacity-60"
            >
              {t('auth.common.resendLink')}
            </button>{' '}
            {t('auth.common.or')}{' '}
            <button type="button" onClick={reset} className="font-semibold text-brand hover:text-brand-hover hover:underline">
              {t('auth.forgot.changeEmail')}
            </button>
          </p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={<BackToLogin />}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input
          id="forgot-email"
          label={t('auth.common.email')}
          type="email"
          icon={<Mail className="size-4" />}
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="mt-4">
          <SubmitButton isLoading={isLoading}>{t('auth.forgot.submit')}</SubmitButton>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default ForgotPassword;
