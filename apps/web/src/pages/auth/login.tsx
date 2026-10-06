import { Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Input, InputPassword } from '@kodinga-mono-repo/ui';

import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { SubmitButton } from './components/submit-button';
import UseLoginForm from './hooks/UseLoginForm';

function Login() {
  const { register, errors, formError, onSubmit, isLoading } = UseLoginForm();

  return (
    <AuthWrapper
      title="Se connecter"
      subtitle="Content de vous revoir ! Retrouvez vos communautés."
      footer={
        <>
          En vous connectant, vous acceptez nos conditions d'utilisation
          <br />
          et notre politique de confidentialité.
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        {formError && <FormAlert>{formError}</FormAlert>}

        <Input
          id="login-email"
          label="Adresse email"
          type="email"
          icon={<Mail className="size-4" />}
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <InputPassword
            id="login-password"
            label="Mot de passe"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="mt-2 text-right">
            <Link
              to="/auth/forgot-password"
              className="text-sm font-semibold text-brand hover:text-brand-hover hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <SubmitButton isLoading={isLoading}>Se connecter</SubmitButton>
        </div>
      </form>
    </AuthWrapper>
  );
}

export default Login;
