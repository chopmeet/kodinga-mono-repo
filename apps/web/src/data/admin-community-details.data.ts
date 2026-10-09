// Mock data for the admin community details page. Values mirror the api choices
// (memberships/models/member.py, posts/models/post.py, billing/models/payment.py).
// Generated per community and deterministic (same slug -> same rows) so the UI is stable.
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { adminCommunities } from './admin-communities.data';

export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member';
export type MemberStatus = 'active' | 'pending' | 'rejected' | 'suspended' | 'banned' | 'left';
export type PostType = 'discussion' | 'question' | 'project_showcase' | 'poll' | 'announcement';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';

export type AdminMember = {
  id: string;
  name: string;
  username: string;
  city: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  posts_count: number;
};

export type AdminPost = {
  id: string;
  title: string;
  author: string;
  type: PostType;
  is_pinned: boolean;
  is_locked: boolean;
  reactions_count: number;
  comments_count: number;
  created_at: string;
};

export type AdminPayment = {
  id: string;
  member: string;
  plan: string;
  amount: number;
  currency: 'XOF';
  method: string;
  status: PaymentStatus;
  created_at: string;
};

export type CommunityRules = {
  rules: { title: string; description: string }[];
  settings: {
    require_approval_to_join: boolean;
    allow_member_invites: boolean;
    default_post_permission: 'all_members' | 'moderators_only' | 'admins_only';
    welcome_message: string;
  };
};

/** Small deterministic PRNG seeded by the slug */
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rand: () => number, items: readonly T[]) => items[Math.floor(rand() * items.length)];

const FIRST = ['Awa', 'Kofi', 'Aïcha', 'Chidi', 'Moussa', 'Fatou', 'Yao', 'Amina', 'Tunde', 'Wanjiru', 'Ibrahima', 'Nadia', 'Kwame', 'Mariam', 'Samuel', 'Zainab'];
const LAST = ['Diallo', 'Mensah', 'Traoré', 'Okafor', 'Ndiaye', 'Sow', 'Kouassi', 'Yusuf', 'Bakare', 'Kamau', 'Camara', 'Benali', 'Asante', 'Keita', 'Otieno', 'Bello'];
const CITIES = ['Dakar', 'Abidjan', 'Lagos', 'Nairobi', 'Accra', 'Kigali', 'Douala', 'Bamako', 'Cotonou', 'Kinshasa'];
const TITLES = [
  'Bienvenue aux nouveaux membres : présentez-vous !',
  'Retour d’expérience : notre migration en production',
  'Quelle architecture pour démarrer un side project ?',
  'Live jeudi 19h : questions/réponses',
  'Je partage mon projet open source, vos retours ?',
  'Sondage : quel sujet pour le prochain atelier ?',
  'Ressources pour bien débuter (mise à jour)',
  'Bug bizarre en prod, quelqu’un a déjà vu ça ?',
  'Offre de stage remote, profil junior bienvenu',
  'Compte rendu du meetup du mois',
];
const METHODS = ['Orange Money', 'Wave', 'MTN MoMo', 'Moov Money', 'Carte bancaire'];

const daysAgo = (days: number) => new Date(Date.UTC(2026, 9, 9) - days * 86_400_000).toISOString();

export function getAdminCommunity(slug: string | undefined): CommunityListItem | undefined {
  return adminCommunities.find((c) => c.slug === slug);
}

export function getCommunityMembers(community: CommunityListItem): AdminMember[] {
  const rand = seeded(`${community.slug}:members`);
  const count = Math.min(28, Math.max(8, Math.round(community.members_count / 150)));
  return Array.from({ length: count }, (_, i) => {
    const name = i === 0 ? community.owner.full_name : `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
    const role: MemberRole = i === 0 ? 'owner' : i <= 2 ? 'admin' : i <= 4 ? 'moderator' : 'member';
    const r = rand();
    const status: MemberStatus =
      role !== 'member' ? 'active' : r < 0.78 ? 'active' : r < 0.88 ? 'pending' : r < 0.94 ? 'suspended' : 'banned';
    return {
      id: `${community.slug}-m${i}`,
      name,
      // Drop accents first ("Aïcha" -> "aicha"), then join the words with dots
      username: name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z]+/g, '.')
        .replace(/^\.|\.$/g, ''),
      city: pick(rand, CITIES),
      role,
      status,
      joined_at: daysAgo(i === 0 ? 400 : Math.floor(rand() * 380)),
      posts_count: Math.floor(rand() * (role === 'member' ? 40 : 120)),
    };
  });
}

export function getCommunityPosts(community: CommunityListItem): AdminPost[] {
  const rand = seeded(`${community.slug}:posts`);
  const members = getCommunityMembers(community);
  return TITLES.map((title, i) => ({
    id: `${community.slug}-p${i}`,
    title,
    author: i === 0 ? community.owner.full_name : pick(rand, members).name,
    type: (['announcement', 'discussion', 'question', 'announcement', 'project_showcase', 'poll', 'discussion', 'question', 'discussion', 'discussion'] as const)[i],
    is_pinned: i === 0,
    is_locked: i === 8,
    reactions_count: Math.floor(rand() * 220),
    comments_count: Math.floor(rand() * 90),
    created_at: daysAgo(i === 0 ? 120 : Math.floor(rand() * 60)),
  })).sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at));
}

/** Paid communities only (free ones have no payments) */
export function getCommunityPayments(community: CommunityListItem): AdminPayment[] {
  if (community.pricing_type !== 'paid') return [];
  const rand = seeded(`${community.slug}:payments`);
  const members = getCommunityMembers(community).filter((m) => m.role === 'member');
  return Array.from({ length: 14 }, (_, i) => {
    const r = rand();
    const yearly = rand() < 0.2;
    return {
      id: `${community.slug}-pay${i}`,
      member: pick(rand, members).name,
      plan: yearly ? 'Annuel' : 'Mensuel',
      amount: yearly ? 150_000 : 15_000,
      currency: 'XOF' as const,
      method: pick(rand, METHODS),
      status: (r < 0.8 ? 'PAID' : r < 0.88 ? 'PENDING' : r < 0.95 ? 'FAILED' : 'CANCELLED') as PaymentStatus,
      created_at: daysAgo(Math.floor(rand() * 45)),
    };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getCommunityRules(community: CommunityListItem): CommunityRules {
  return {
    rules: [
      { title: 'Bienveillance avant tout', description: 'Respect des membres, en français comme en anglais.' },
      { title: 'Pas d’autopromotion', description: 'Les annonces commerciales passent par le canal dédié.' },
      { title: 'Du code reproductible', description: 'Partagez un exemple minimal quand vous demandez de l’aide.' },
    ],
    settings: {
      require_approval_to_join: community.privacy_type !== 'public',
      allow_member_invites: community.privacy_type === 'public',
      default_post_permission: community.members_count > 3000 ? 'moderators_only' : 'all_members',
      welcome_message: `Bienvenue dans ${community.name} ! Présentez-vous dans le fil.`,
    },
  };
}
