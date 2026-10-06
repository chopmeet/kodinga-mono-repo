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
