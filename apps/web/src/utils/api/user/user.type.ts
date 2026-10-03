export enum UserType {
  admin = 'admin',
  superAdmin = 'superadmin',
  user = 'user',
}

export type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  userType: UserType;
  avatar?: string;
  isActive: boolean;
};

export interface AuthState {
  user: User | null;
  token: string | null;
}

export type UserFormData = Partial<Omit<User, 'id'>>;

export type PaginationResults<T> = {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
};

export type TypeQuery = Partial<{
  page: number;
  limit: number;
  search: string;
  ordering: string;
}>;
