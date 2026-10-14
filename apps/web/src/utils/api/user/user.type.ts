// Mirrors apps/accounts/serializers/user.py (UserSerializer)
export type User = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  is_email_verified: boolean;
  preferred_language: string;
  timezone: string;
  date_joined: string;
  last_login: string | null;
  /** Not exposed by the api yet */
  avatar?: string;
  /** Not exposed by the api yet: admin area stays closed until it is */
  is_staff?: boolean;
};

export interface AuthState {
  user: User | null;
  /** JWT access token */
  token: string | null;
  /** JWT refresh token (needed to log out server-side) */
  refresh?: string | null;
}

export type UserFormData = Partial<
  Pick<User, 
    'first_name' | 
    'last_name' | 
    'preferred_language' | 
    'timezone'
  >
>;

/** GET users/: `active` = active with a verified email, `inactive` = suspended account */
export type UsersQuery = {
  search?: string;
  status?: 'active' | 'unverified' | 'inactive';
  page?: number;
  page_size?: number;
};
