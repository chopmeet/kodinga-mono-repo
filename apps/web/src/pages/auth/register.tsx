import { AtSign, Mail, MailCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Input, InputPassword } from '@kodinga-mono-repo/ui';

import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { OAuthButtons } from './components/oauth-buttons';
import { PasswordCheck } from './components/password-check';
import { SubmitButton } from './components/submit-button';
import UseRegisterForm from './hooks/UseRegisterForm';

const linkClassName = 'font-semibold text-brand hover:text-brand-hover hover:underline';

const loginFooter = (
  <>
    Déjà un compte ?{' '}
    <Link to="/auth/login" className={linkClassName}>
      Se connecter
    </Link>
  </>
);

function Register() {
  const {
    register,
    errors,
    formError,
    isLoading,
    password,
    syncUsername,
    onSubmit,
    sentTo,
    resend,
    isResending,
    resent,
    changeEmail,
  } = UseRegisterForm();

  if (sentTo) {
    return (
      <AuthWrapper title="Vérifiez vos emails" footer={loginFooter}>
        <div className="flex flex-col gap-5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <MailCheck className="size-6" />
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600">
            Votre compte est créé. Nous avons envoyé un lien de confirmation à{' '}
            <strong className="font-semibold text-slate-900">{sentTo}</strong> : cliquez dessus pour activer votre
            compte. Pensez à vérifier vos spams.
          </p>
          {formError && <FormAlert>{formError}</FormAlert>}
          {resent && <FormAlert variant="success">Un nouveau lien vient de vous être envoyé.</FormAlert>}
          <p className="text-sm text-slate-500">
            Rien reçu ?{' '}
            <button
              type="button"
              onClick={resend}
              disabled={isResending}
              className="font-semibold text-brand hover:text-brand-hover hover:underline disabled:opacity-60"
            >
              Renvoyer le lien
            </button>{' '}
            ou{' '}
            <button type="button" onClick={changeEmail} className={linkClassName}>
              corriger l'adresse
            </button>
          </p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper title="Créer un compte" subtitle="Rejoignez les communautés tech d'Afrique, gratuitement." footer={loginFooter}>
      <OAuthButtons />

      <div className="my-6 flex items-center gap-3 text-sm text-slate-400" role="separator">
        <span className="h-px flex-1 bg-slate-200" />
        ou avec votre email
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        {formError && <FormAlert>{formError}</FormAlert>}

        <div className="grid gap-x-3 sm:grid-cols-2">
          <Input
            id="register-first-name"
            label="Prénom"
            autoComplete="given-name"
            required
            error={errors.first_name?.message}
            {...register('first_name', { onChange: syncUsername })}
          />
          <Input
            id="register-last-name"
            label="Nom"
            autoComplete="family-name"
            required
            error={errors.last_name?.message}
            {...register('last_name', { onChange: syncUsername })}
          />
        </div>

        <Input
          id="register-username"
          label="Nom d'utilisateur"
          icon={<AtSign className="size-4" />}
          autoComplete="username"
          required
          fieldHelp="Visible par les autres membres. Lettres, chiffres, « _ » et « - »."
          error={errors.username?.message}
          {...register('username')}
        />

        <Input
          id="register-email"
          label="Adresse email"
          type="email"
          icon={<Mail className="size-4" />}
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />

        <InputPassword
          id="register-password"
          label="Mot de passe"
          autoComplete="new-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />
        {password.length > 0 && (
          <div className="mb-3">
            <PasswordCheck password={password} />
          </div>
        )}

        <div className="mt-1">
          <label htmlFor="register-terms" className="flex items-start gap-3 text-sm leading-relaxed text-slate-600">
            <input
              id="register-terms"
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-(--primary)"
              aria-invalid={!!errors.terms_accepted}
              aria-describedby={errors.terms_accepted ? 'register-terms-error' : undefined}
              {...register('terms_accepted')}
            />
            <span>J'accepte les conditions d'utilisation et la politique de confidentialité de Kodinga.</span>
          </label>
          {errors.terms_accepted && (
            <p id="register-terms-error" className="mt-1.5 text-sm text-red-600">
              {errors.terms_accepted.message}
            </p>
          )}
        </div>

        <div className="mt-4">
          <SubmitButton isLoading={isLoading}>Créer mon compte</SubmitButton>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default Register;
