import type { User } from '../user/user.type';

// Mirrors apps/accounts/serializers/auth.py

export type LoginFormData = {
  email: string;
  password: string;
  device_name?: string;
};

export type LoginResult = {
  access: string;
  refresh: string;
  session_id: string;
  user: User;
};

export type ForgotPasswordFormData = {
  email: string;
};

export type ResetPasswordFormData = {
  /** From the emailed link: /auth/reset-password?token=... */
  token: string;
  new_password: string;
  confirm_password: string;
};

/** RegisterSerializer: username is lowercased by the api (letters, digits, "_" and "-") */
export type RegisterFormData = {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  preferred_language: string;
  timezone: string;
  terms_accepted: boolean;
};

export type VerifyEmailData = {
  /** From the emailed link: /auth/verify-email?token=... */
  token: string;
};

export type OAuthProvider = 'google' | 'github';

/** GET auth/<provider>/start/: where to send the browser, and the state to check on return */
export type OAuthStartResult = { url: string; state: string };

/** POST auth/<provider>/callback/ (same redirect_uri as the start), answers a LoginResult */
export type OAuthCallbackData = {
  provider: OAuthProvider;
  code: string;
  state: string;
  redirect_uri: string;
};
