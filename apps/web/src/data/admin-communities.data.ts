// Mock data for the admin "Communautés" tab, in the exact shapes of the api
// (utils/api/community/community.type.ts). When the admin endpoint exists, swap
// pages/admin/communities/form/UseCommunitiesList.ts for useGetCommunitiesQuery.
import type { CommunityCategory, CommunityListItem } from '@/utils/api/community/community.type';
import type { User } from '@/utils/api/user/user.type';
import { communities as homeCommunities, type StackId } from './home.data';

const createdAt = '2025-01-01T09:00:00Z';

export const adminCategories: CommunityCategory[] = [
  { id: 'cat-ai', name: 'IA & Data', slug: 'ia-data', description: '', icon_url: '', order: 1, created_at: createdAt },
  { id: 'cat-cloud', name: 'Cloud & DevOps', slug: 'cloud-devops', description: '', icon_url: '', order: 2, created_at: createdAt },
  { id: 'cat-systems', name: 'Systèmes', slug: 'systemes', description: '', icon_url: '', order: 3, created_at: createdAt },
  { id: 'cat-web', name: 'Web & Mobile', slug: 'web-mobile', description: '', icon_url: '', order: 4, created_at: createdAt },
  { id: 'cat-web3', name: 'Web3 & Fintech', slug: 'web3-fintech', description: '', icon_url: '', order: 5, created_at: createdAt },
  { id: 'cat-career', name: 'Carrière', slug: 'carriere', description: '', icon_url: '', order: 6, created_at: createdAt },
];

const categoryBySlug = Object.fromEntries(adminCategories.map((c) => [c.slug, c]));

const categoryForStack: Record<StackId, string> = {
  'python-ai': 'ia-data',
  'cloud-devops': 'cloud-devops',
  rust: 'systemes',
  systems: 'systemes',
  typescript: 'web-mobile',
  'mobile-flutter': 'web-mobile',
  'web3-fintech': 'web3-fintech',
  cybersecurity: 'systemes',
};

const owner = (id: string, first_name: string, last_name: string): User => ({
  id,
  email: `${first_name}.${last_name}@kodinga.dev`.toLowerCase().replace(/[^a-z.@-]/g, ''),
  username: first_name.toLowerCase(),
  first_name,
  last_name,
  full_name: `${first_name} ${last_name}`,
  is_active: true,
  is_email_verified: true,
  preferred_language: 'fr',
  timezone: 'Africa/Dakar',
  date_joined: createdAt,
  last_login: null,
});

const owners = [
  owner('u1', 'Moussa', 'Diallo'),
  owner('u2', 'Chidi', 'Okafor'),
  owner('u3', 'Awa', 'Ndiaye'),
  owner('u4', 'Wanjiru', 'Kamau'),
  owner('u5', 'Yao', 'Kouassi'),
  owner('u6', 'Tunde', 'Bakare'),
  owner('u7', 'Amina', 'Yusuf'),
  owner('u8', 'Jean-Luc', 'Habimana'),
  owner('u9', 'Fatou', 'Sow'),
];

// The 9 communities of the home page, with their cover photos as avatars
const fromHome: CommunityListItem[] = homeCommunities.map((c, i) => ({
  id: c.id,
  name: c.name,
  slug: c.id,
  tagline: c.description,
  avatar_url: c.image,
  banner_url: c.image,
  brand_color: null,
  category: categoryBySlug[c.stacks[0] ? categoryForStack[c.stacks[0]] : 'carriere'],
  owner: owners[i % owners.length],
  privacy_type: c.access.kind === 'application' ? 'private' : 'public',
  pricing_type: c.access.kind === 'paid' ? 'paid' : 'free',
  is_verified: c.categories.includes('top'),
  is_featured: c.categories.includes('trending'),
  members_count: c.members,
  posts_count: Math.round(c.members * 2.6),
  courses_count: 4,
  events_count: 3,
  created_at: `${c.createdAt}T09:00:00Z`,
}));

// Smaller communities to fill a few pages (no avatar: initials + brand color)
const extras: [string, string, CommunityListItem['privacy_type'], CommunityListItem['pricing_type'], number, string][] = [
  ['Abidjan Flutter Devs', 'web-mobile', 'public', 'free', 1240, '#0ea5e9'],
  ['Accra Cyber Defenders', 'systemes', 'private', 'paid', 980, '#dc2626'],
  ['Cotonou JavaScript', 'web-mobile', 'public', 'free', 860, '#ca8a04'],
  ['Douala Data Science', 'ia-data', 'public', 'free', 1530, '#16a34a'],
  ['Kampala Cloud Native', 'cloud-devops', 'public', 'paid', 640, '#2563eb'],
  ['Bamako Open Source', 'systemes', 'public', 'free', 410, '#7c3aed'],
  ['Lomé Product Builders', 'carriere', 'private', 'free', 330, '#db2777'],
  ['Kinshasa Mobile Money Devs', 'web3-fintech', 'public', 'paid', 1120, '#0891b2'],
  ['Addis AI Research', 'ia-data', 'secret', 'free', 260, '#4f46e5'],
  ['Tunis Go Gophers', 'cloud-devops', 'public', 'free', 720, '#0d9488'],
  ['Casablanca Security Lab', 'systemes', 'secret', 'paid', 190, '#b91c1c'],
  ['Ouaga Women in Tech', 'carriere', 'public', 'free', 1450, '#c026d3'],
  ['Johannesburg Platform Eng.', 'cloud-devops', 'private', 'paid', 870, '#1d4ed8'],
  ['Niamey Embedded Makers', 'systemes', 'public', 'free', 150, '#65a30d'],
  ['Freetown Web Starters', 'web-mobile', 'public', 'free', 95, '#ea580c'],
];

const slugify = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const fromExtras: CommunityListItem[] = extras.map(([name, category, privacy, pricing, members, color], i) => ({
  id: `extra-${i}`,
  name,
  slug: slugify(name),
  tagline: `Communauté ${name}`,
  avatar_url: '',
  banner_url: '',
  brand_color: color,
  category: categoryBySlug[category],
  owner: owners[(i + 3) % owners.length],
  privacy_type: privacy,
  pricing_type: pricing,
  is_verified: members > 1000,
  is_featured: false,
  members_count: members,
  posts_count: Math.round(members * 1.8),
  courses_count: i % 4,
  events_count: i % 3,
  created_at: `2026-0${(i % 9) + 1}-1${i % 9}T09:00:00Z`,
}));

/** Same default order as the api: featured first, then by members */
export const adminCommunities: CommunityListItem[] = [...fromHome, ...fromExtras].sort(
  (a, b) => Number(b.is_featured) - Number(a.is_featured) || b.members_count - a.members_count
);
