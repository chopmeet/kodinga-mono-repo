import { CircleCheck, Mail } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Input, Loader } from '@kodinga-mono-repo/ui';
import { useResendVerificationMutation, useVerifyEmailMutation } from '@/utils/api/auth/auth.api';
import { parseApiError } from '@/utils/api/errors';
import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { SubmitButton } from './components/submit-button';

const linkClassName = 'font-semibold text-brand hover:text-brand-hover hover:underline';

/** Asks for a new link when the emailed one is invalid or expired */
function ResendLink() {
  const [resendVerification, { isLoading }] = useResendVerificationMutation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Adresse email invalide');
      return;
    }
    setError(null);
    try {
      await resendVerification({ email: email.trim().toLowerCase() }).unwrap();
      setSent(true);
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  if (sent) {
    return <FormAlert variant="success">Si un compte non vérifié existe pour cette adresse, un nouveau lien vient d'être envoyé.</FormAlert>;
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <Input
        id="verify-resend-email"
        label="Recevoir un nouveau lien"
        type="email"
        icon={<Mail className="size-4" />}
        autoComplete="email"
        placeholder="Votre adresse email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error ?? undefined}
      />
      <SubmitButton isLoading={isLoading}>Renvoyer le lien</SubmitButton>
    </form>
  );
}

/** /auth/verify-email?token=… — the link of the registration email */
function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [verifyEmail] = useVerifyEmailMutation();
  const [status, setStatus] = useState<'pending' | 'done' | 'invalid'>(token.length < 10 ? 'invalid' : 'pending');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice in dev: a token is single use
  const started = useRef(false);

  useEffect(() => {
    if (status !== 'pending' || started.current) return;
    started.current = true;
    verifyEmail({ token })
      .unwrap()
      .then((user) => {
        setFirstName(user.first_name);
        setStatus('done');
      })
      .catch((err) => {
        const { code, message } = parseApiError(err);
        if (code !== 'invalid_verification_token') setError(message);
        setStatus('invalid');
      });
  }, [status, token, verifyEmail]);

  if (status === 'pending') {
    return (
      <AuthWrapper title="Vérification…">
        <Loader inline size="sm" className="py-6" message="Nous vérifions votre adresse email." />
      </AuthWrapper>
    );
  }

  if (status === 'done') {
    return (
      <AuthWrapper title={firstName ? `Bienvenue ${firstName} !` : 'Adresse vérifiée'}>
        <div className="flex flex-col gap-6">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CircleCheck className="size-6" />
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600">
            Votre adresse email est confirmée et votre compte est actif. Connectez-vous pour rejoindre vos premières
            communautés.
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
        <FormAlert>{error ?? 'Ce lien de vérification est invalide ou a expiré.'}</FormAlert>
        <p className="text-[15px] text-slate-600">Les liens ne sont valables qu'une seule fois et pour une durée limitée.</p>
        <ResendLink />
      </div>
    </AuthWrapper>
  );
}

export default VerifyEmail;
