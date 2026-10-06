import { useAppSelector } from '@/redux/hook';
import type { User } from './api/user/user.type';

/** The api does not expose roles yet (see User.is_staff) */
export const isAdmin = (user?: User | null) => !!user?.is_staff;

export const useUser = () => useAppSelector((s) => s.user.user);

export const getName = (user?: User | null) =>
  user?.full_name?.trim() ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
  user?.username ||
  '';

export function getInitials(user?: User | null): string {
  const parts = getName(user).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Builds `path/?a=1&b=2`, skipping empty values. */
export const QueryUrl = (path: string, query: object = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `${path}/?${qs}` : `${path}/`;
};

const compactNumber = new Intl.NumberFormat('fr-FR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** 5800 → "5,8 k" */
export const formatCompact = (value: number) => compactNumber.format(value);

/** Smooth-scrolls to the home results (the sticky filters strip sits on top of the grid). */
export const scrollToResults = () =>
  document.getElementById('grille-communautes')?.scrollIntoView({ behavior: 'smooth' });
