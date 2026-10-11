import { CircleCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { InputPassword } from '@kodinga-mono-repo/ui';

import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { PasswordCheck } from './components/password-check';
import { SubmitButton } from './components/submit-button';
import UseResetPasswordForm from './hooks/UseResetPasswordForm';

const linkClassName = 'font-semibold text-brand hover:text-brand-hover hover:underline';

function ResetPassword() {
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
      <AuthWrapper title="Mot de passe modifié">
        <div className="flex flex-col gap-6">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CircleCheck className="size-6" />
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600">
            Votre mot de passe a bien été réinitialisé. Par sécurité, vous avez été déconnecté de tous vos
            appareils.
          </p>
          <Link
            to="/auth/login"
            className="flex h-13 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-white shadow-sm hover:bg-brand-hover"
          >
            Se connecter
          </Link>
        </div>
      </AuthWrapper>
    );
  }

  if (linkInvalid) {
    return (
      <AuthWrapper
        title="Lien invalide"
        footer={
          <Link to="/auth/login" className={linkClassName}>
            Retour à la connexion
          </Link>
        }
      >
        <div className="flex flex-col gap-5">
          <FormAlert>Ce lien de réinitialisation est invalide ou a expiré.</FormAlert>
          <p className="text-[15px] text-slate-600">
            Les liens ne sont valables qu'une seule fois et pour une durée limitée.{' '}
            <Link to="/auth/forgot-password" className={linkClassName}>
              Demander un nouveau lien
            </Link>
          </p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper title="Nouveau mot de passe" subtitle="Choisissez un mot de passe que vous n'utilisez pas ailleurs.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        {formError && <FormAlert>{formError}</FormAlert>}

        <InputPassword
          id="reset-password"
          label="Nouveau mot de passe"
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
          label="Confirmer le mot de passe"
          autoComplete="new-password"
          required
          error={errors.confirm_password?.message}
          {...register('confirm_password')}
        />

        <div className="mt-4">
          <SubmitButton isLoading={isLoading}>Réinitialiser le mot de passe</SubmitButton>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default ResetPassword;
