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
  is_creator?: boolean;
  communities_created_count?: number;
  account_role?: 'creator' | 'member' | 'admin';
  avatar?: string;
  is_staff?: boolean;
  is_superadmin?: boolean;
  is_superuser?: boolean;
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

export type UserRoleFilter = 'creator' | 'member' | 'admin';
export type UserPeriodFilter = '7d' | '30d' | '90d';

/** GET users/: `active` = active with a verified email, `inactive` = suspended account */
export type UsersQuery = {
  search?: string;
  status?: 'active' | 'unverified' | 'inactive';
  role?: UserRoleFilter;
  period?: UserPeriodFilter;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};

export type AdminUsersKPIs = {
  total_users: number;
  creators_count: number;
  members_count: number;
  admins_count: number;
  active_users_count: number;
  unverified_users_count: number;
  suspended_users_count: number;
  new_users_7d: number;
  new_users_30d: number;
  new_users_90d: number;
};
