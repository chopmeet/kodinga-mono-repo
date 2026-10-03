import type { User } from '../user/user.type';

export type LoginFormData = {
  email: string;
  password: string;
};

export type LoginResult = {
  user: User;
  access: string;
  refresh?: string;
};

export type ForgotPasswordFormData = {
  email: string;
};

export type ResetPasswordFormData = {
  email: string;
  code: string;
  password: string;
  passwordConfirmation: string;
};
