// Mock data for the admin "Utilisateurs" tab. Base fields mirror the api UserSerializer
// (utils/api/user/user.type.ts); the admin-only fields (is_staff, counts, city) are what an
// admin users endpoint would need to add. Deterministic: same rows on every load.
import type { User } from '@/utils/api/user/user.type';
import { adminCommunities } from './admin-communities.data';

export type AdminUser = User & {
  is_staff: boolean;
  city: string;
  communities_owned: number;
  communities_joined: number;
  posts_count: number;
};

/** What the role filter means for an admin */
export type UserRoleFilter = 'all' | 'staff' | 'creator' | 'member';
export type UserStatusFilter = 'all' | 'active' | 'suspended' | 'unverified';

const FIRST = ['Awa', 'Kofi', 'Aïcha', 'Ibrahima', 'Nadia', 'Kwame', 'Mariam', 'Samuel', 'Zainab', 'Ousmane', 'Grace', 'Malick', 'Esther', 'Youssef', 'Adama', 'Ruth', 'Cheikh', 'Imani', 'Boubacar', 'Lina'];
const LAST = ['Camara', 'Benali', 'Asante', 'Keita', 'Otieno', 'Bello', 'Mbaye', 'Kone', 'Mutua', 'Adeyemi', 'Sylla', 'Nkosi', 'Tchami', 'Haidara', 'Wanjala'];
const CITIES = ['Dakar', 'Abidjan', 'Lagos', 'Nairobi', 'Accra', 'Kigali', 'Douala', 'Bamako', 'Cotonou', 'Kinshasa', 'Casablanca', 'Tunis'];

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '');

const daysAgo = (days: number) => new Date(Date.UTC(2026, 9, 9, 10) - days * 86_400_000).toISOString();

const base = (id: string, first_name: string, last_name: string, joinedDaysAgo: number): User => ({
  id,
  email: `${slug(first_name)}.${slug(last_name)}@kodinga.dev`,
  username: `${slug(first_name)}${slug(last_name).slice(0, 3)}`,
  first_name,
  last_name,
  full_name: `${first_name} ${last_name}`,
  is_active: true,
  is_email_verified: true,
  preferred_language: 'fr',
  timezone: 'Africa/Dakar',
  date_joined: daysAgo(joinedDaysAgo),
  last_login: daysAgo(Math.max(0, joinedDaysAgo % 9)),
});

// Community owners of the "Communautés" tab, with their real owned counts
const ownerIds = new Map<string, number>();
for (const c of adminCommunities) ownerIds.set(c.owner.id, (ownerIds.get(c.owner.id) ?? 0) + 1);

const owners: AdminUser[] = adminCommunities
  .map((c) => c.owner)
  .filter((u, i, all) => all.findIndex((x) => x.id === u.id) === i)
  .map((u, i) => ({
    ...u,
    date_joined: daysAgo(300 + i * 23),
    last_login: daysAgo(i % 4),
    is_staff: false,
    city: CITIES[i % CITIES.length],
    communities_owned: ownerIds.get(u.id) ?? 0,
    communities_joined: 3 + (i % 5),
    posts_count: 120 + i * 37,
  }));

const staff: AdminUser[] = [
  { ...base('staff-1', 'Hassan', 'Fassane', 520), is_staff: true, city: 'Dakar', communities_owned: 0, communities_joined: 6, posts_count: 42 },
  { ...base('staff-2', 'Mame', 'Diarra', 410), is_staff: true, city: 'Abidjan', communities_owned: 0, communities_joined: 4, posts_count: 18 },
];

const members: AdminUser[] = Array.from({ length: 37 }, (_, i) => {
  const first = FIRST[(i * 7) % FIRST.length];
  const last = LAST[(i * 11) % LAST.length];
  const joined = (i * 13) % 360;
  return {
    ...base(`user-${i}`, first, last, joined),
    // A few suspended accounts and unverified emails to filter on
    is_active: i % 11 !== 4,
    is_email_verified: i % 6 !== 2,
    last_login: i % 6 === 2 ? null : daysAgo(joined % 20),
    is_staff: false,
    city: CITIES[(i * 5) % CITIES.length],
    communities_owned: 0,
    communities_joined: (i * 3) % 7,
    posts_count: (i * 17) % 90,
  };
});

/** Newest first, like an admin list endpoint would return */
export const adminUsers: AdminUser[] = [...staff, ...owners, ...members].sort((a, b) =>
  b.date_joined.localeCompare(a.date_joined)
);

export const userRole = (u: AdminUser): Exclude<UserRoleFilter, 'all'> =>
  u.is_staff ? 'staff' : u.communities_owned > 0 ? 'creator' : 'member';
