import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Input } from '@kodinga-mono-repo/ui';

import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { SubmitButton } from './components/submit-button';
import UseForgotPasswordForm from './hooks/UseForgotPasswordForm';

const backToLogin = (
  <Link
    to="/auth/login"
    className="inline-flex items-center gap-1.5 font-semibold text-brand hover:text-brand-hover hover:underline"
  >
    <ArrowLeft className="size-4" />
    Retour à la connexion
  </Link>
);

function ForgotPassword() {
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
      <AuthWrapper title="Vérifiez vos emails" footer={backToLogin}>
        <div className="flex flex-col gap-5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <MailCheck className="size-6" />
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600">
            Si un compte existe pour <strong className="font-semibold text-slate-900">{sentTo}</strong>, vous
            allez recevoir un lien pour choisir un nouveau mot de passe. Pensez à vérifier vos spams.
          </p>
          {formError && <FormAlert>{formError}</FormAlert>}
          <p className="text-sm text-slate-500">
            Rien reçu ?{' '}
            <button
              type="button"
              onClick={resend}
              disabled={isLoading}
              className="font-semibold text-brand hover:text-brand-hover hover:underline disabled:opacity-60"
            >
              Renvoyer le lien
            </button>{' '}
            ou{' '}
            <button type="button" onClick={reset} className="font-semibold text-brand hover:text-brand-hover hover:underline">
              changer d'adresse
            </button>
          </p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper
      title="Mot de passe oublié"
      subtitle="Indiquez votre adresse email : nous vous enverrons un lien pour en choisir un nouveau."
      footer={backToLogin}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        {formError && <FormAlert>{formError}</FormAlert>}
        <Input
          id="forgot-email"
          label="Adresse email"
          type="email"
          icon={<Mail className="size-4" />}
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="mt-4">
          <SubmitButton isLoading={isLoading}>Envoyer le lien</SubmitButton>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default ForgotPassword;
