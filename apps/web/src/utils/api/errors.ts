import type { ApiErrorBody } from './api.type';

import i18n from '../i18n';
import type { fr } from '@/locales/fr';

type ErrorCode = keyof typeof fr.errors.codes;
type FieldMessage = keyof typeof fr.errors.fields;

// The api validators answer in English: our own text for each message the forms can show
const fieldMessages: Record<string, FieldMessage> = {
  'An account with this email address already exists.': 'emailTaken',
  'This username is already taken.': 'usernameTaken',
  'Username must be at least 3 characters long.': 'usernameShort',
  'Username can only contain alphanumeric characters, underscores, and hyphens.': 'usernameChars',
  'You must accept the terms of service to create an account.': 'termsRequired',
  'This password is too common.': 'passwordCommon',
  'This password is entirely numeric.': 'passwordNumeric',
  'Enter a valid email address.': 'emailInvalid',
  'Enter a valid URL.': 'urlInvalid',
  'Current password is incorrect.': 'currentPasswordWrong',
  'Passwords do not match.': 'passwordsMismatch',
  'New password cannot be the same as current password.': 'passwordSame',
  'This password is too short. It must contain at least 8 characters.': 'passwordShort',
};

const isErrorCode = (code: string): code is ErrorCode => code in i18n.getResource('fr', 'translation', 'errors.codes');

/** Our text, in the current language, for a message of the api validators (the message itself otherwise) */
export function translateApiMessage(message: string) {
  const key = fieldMessages[message] ?? (message.startsWith('The password is too similar to the') ? 'passwordSimilar' : null);
  return key ? i18n.t(`errors.fields.${key}`) : message;
}

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
      message: err?.status === 'FETCH_ERROR' ? i18n.t('errors.network') : i18n.t('errors.unexpected'),
      fields: {},
    };
  }

  const fields: Record<string, string> = {};
  for (const [field, value] of Object.entries(body.details ?? {})) {
    const messages = (Array.isArray(value) ? value : [value]).filter(Boolean).map(String).map(translateApiMessage);
    if (messages.length === 0) continue;
    // Field errors: first message under the input. Form-level errors: show them all
    // (e.g. Django password validators: "trop courant." + "entièrement numérique.")
    fields[field] = field === 'non_field_errors' ? messages.join(' ') : messages[0];
  }

  const code = body.code ?? 'error';
  return {
    code,
    message: (isErrorCode(code) ? i18n.t(`errors.codes.${code}`) : null) ?? fields.non_field_errors ?? body.message ?? i18n.t('errors.generic'),
    fields,
  };
}
