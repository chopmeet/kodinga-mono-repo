import type { ApiErrorBody } from './api.type';

// French messages for the api error codes the auth flow can hit
const messagesByCode: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  account_inactive: 'Ce compte a été désactivé. Contactez le support.',
  invalid_reset_token: 'Ce lien de réinitialisation est invalide ou a expiré.',
  throttled: 'Trop de tentatives. Réessayez dans quelques minutes.',
};

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
    const messages = (Array.isArray(value) ? value : [value]).filter(Boolean).map(String);
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
