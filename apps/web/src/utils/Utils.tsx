import { useAppSelector } from '@/redux/hook';
import type { User } from './api/user/user.type';

/** The api does not expose roles yet (see User.is_staff) */
export const isAdmin = (user?: User | null) => !!user?.is_superadmin || !!user?.is_superuser;

export const useUser = () => useAppSelector((s) => s.user.user);

export const getName = (user?: User | null) =>
  user?.full_name?.trim() ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
  user?.username ||
  '';

export function nameInitials(name: string, fallback = '?'): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const getInitials = (user?: User | null) => nameInitials(getName(user));

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

/** "Dakar DevOps & Cloud" -> "dakar-devops-cloud" (same rule as Django's slugify, accents dropped) */
export const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 160);

/** Builds a CSV (";" separator and BOM, so Excel in French opens it with accents) and downloads it */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = '﻿' + [header, ...rows].map((row) => row.map(escape).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const relative = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
const fullDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Il y a 2 h", "Hier", then the date */
export function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return relative.format(-days, 'day').replace(/^./, (c) => c.toUpperCase());
  return fullDate.format(new Date(iso));
}

/** Plain text of a Markdown post or comment */
export const plain = (content: string) => content.replace(/[#*_`>[\]]/g, '').replace(/[ \t]+/g, ' ').trim();

/** /communities/<slug>/posts/<id> */
export const postHref = (slug: string, postId: string) => `/communities/${slug}/posts/${postId}`;
