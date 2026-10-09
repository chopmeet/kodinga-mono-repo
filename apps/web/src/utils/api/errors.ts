import type { ApiErrorBody } from './api.type';

// French messages for the api error codes the auth flow can hit
const messagesByCode: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  account_inactive: 'Ce compte a été désactivé. Contactez le support.',
  invalid_reset_token: 'Ce lien de réinitialisation est invalide ou a expiré.',
  throttled: 'Trop de tentatives. Réessayez dans quelques minutes.',
  invalid_verification_token: 'Ce lien de vérification est invalide ou a expiré.',
  invalid_provider: 'Ce mode de connexion n’est pas disponible.',
  oauth_exchange_failed: 'La connexion avec ce compte a échoué. Réessayez.',
  oauth_userinfo_failed: 'Impossible de récupérer votre profil. Réessayez.',
  oauth_missing_email: 'Votre compte ne fournit pas d’adresse email vérifiée.',
};

// The api validators answer in English: French versions of the messages the forms can show
const fieldMessages: Record<string, string> = {
  'An account with this email address already exists.': 'Un compte existe déjà avec cette adresse email.',
  'This username is already taken.': "Ce nom d'utilisateur est déjà pris.",
  'Username must be at least 3 characters long.': "Le nom d'utilisateur doit contenir au moins 3 caractères.",
  'Username can only contain alphanumeric characters, underscores, and hyphens.':
    "Lettres, chiffres, « _ » et « - » uniquement.",
  'You must accept the terms of service to create an account.': "Acceptez les conditions d'utilisation pour continuer.",
  'This password is too common.': 'Ce mot de passe est trop courant.',
  'This password is entirely numeric.': 'Le mot de passe ne peut pas contenir uniquement des chiffres.',
  'Enter a valid email address.': 'Adresse email invalide.',
};

const toFrench = (message: string) =>
  fieldMessages[message] ??
  (message.startsWith('The password is too similar to the') ? 'Le mot de passe ressemble trop à vos informations personnelles.' : message);

export type ParsedApiError = {
  code: string;
  message: string;
  fields: Record<string, string>;
};

/** Normalizes an RTK Query error (FetchBaseQueryError | SerializedError) into one shape. */
export function parseApiError(error: unknown): ParsedApiError {
  const err = error as { status?: number | string; data?: Partial<ApiErrorBody> } | undefined;
  const body = err?.data;

  if (!body || typeof body !== 'object') {
    return {
      code: 'network_error',
      message:
        err?.status === 'FETCH_ERROR'
          ? 'Impossible de joindre le serveur. Vérifiez votre connexion.'
          : 'Une erreur inattendue est survenue.',
      fields: {},
    };
  }

  const fields: Record<string, string> = {};
  for (const [field, value] of Object.entries(body.details ?? {})) {
    const messages = (Array.isArray(value) ? value : [value]).filter(Boolean).map(String).map(toFrench);
    if (messages.length === 0) continue;
    // Field errors: first message under the input. Form-level errors: show them all
    // (e.g. Django password validators: "trop courant." + "entièrement numérique.")
    fields[field] = field === 'non_field_errors' ? messages.join(' ') : messages[0];
  }

  const code = body.code ?? 'error';
  return {
    code,
    message: messagesByCode[code] ?? fields.non_field_errors ?? body.message ?? 'Une erreur est survenue.',
    fields,
  };
}
