// Mock data for the admin dashboard. The api has no aggregated admin endpoint yet:
// replace with RTK Query (utils/api/admin/admin.api.ts) once it exists, keeping these shapes.

export type DashboardKpi = {
  id: string;
  label: string;
  value: number;
  /** Displayed with a currency/percent suffix */
  unit?: 'xof' | 'percent';
};

export type MonthlyGrowth = {
  month: string;
  newMembers: number;
  posts: number;
};

export type CommunityRanking = {
  name: string;
  members: number;
};

export type AccessShare = {
  id: 'free' | 'paid' | 'application';
  label: string;
  communities: number;
};

export type PaymentMethodShare = {
  method: string;
  /** Amount collected in XOF over the period */
  amount: number;
};

export type ActivityType = 'community' | 'member' | 'post' | 'payment' | 'report' | 'login';

export type DashboardActivity = {
  id: string;
  type: ActivityType;
  actor: string;
  action: string;
  target: string | null;
  /** ISO date */
  at: string;
};

export const dashboardKpis: DashboardKpi[] = [
  { id: 'communities', label: 'Communautés actives', value: 1240 },
  { id: 'members', label: 'Membres inscrits', value: 48500 },
  { id: 'new-members', label: 'Nouveaux membres (30 j)', value: 3120 },
  { id: 'posts', label: 'Publications (30 j)', value: 18750 },
  { id: 'revenue', label: 'Revenus (30 j)', value: 4_850_000, unit: 'xof' },
  { id: 'paid-rate', label: 'Communautés payantes', value: 18, unit: 'percent' },
];

export const monthlyGrowth: MonthlyGrowth[] = [
  { month: 'Nov', newMembers: 1420, posts: 9800 },
  { month: 'Déc', newMembers: 1310, posts: 9100 },
  { month: 'Jan', newMembers: 1780, posts: 11200 },
  { month: 'Fév', newMembers: 1950, posts: 12100 },
  { month: 'Mar', newMembers: 2240, posts: 13400 },
  { month: 'Avr', newMembers: 2100, posts: 13900 },
  { month: 'Mai', newMembers: 2380, posts: 14800 },
  { month: 'Juin', newMembers: 2560, posts: 15600 },
  { month: 'Juil', newMembers: 2410, posts: 15200 },
  { month: 'Août', newMembers: 2290, posts: 14600 },
  { month: 'Sep', newMembers: 2870, posts: 17300 },
  { month: 'Oct', newMembers: 3120, posts: 18750 },
];

export const topCommunities: CommunityRanking[] = [
  { name: 'AfriCode Mentorship & Jobs', members: 7100 },
  { name: 'Lagos AI & Data Engineers', members: 6200 },
  { name: 'Python Africa Core', members: 5800 },
  { name: 'Frontend Francophone Masters', members: 4200 },
  { name: 'Solidity & Web3 Africa', members: 3600 },
  { name: 'Nairobi Rustaceans', members: 3100 },
];

export const communitiesByAccess: AccessShare[] = [
  { id: 'free', label: 'Gratuites', communities: 942 },
  { id: 'paid', label: 'Payantes', communities: 223 },
  { id: 'application', label: 'Sur candidature', communities: 75 },
];

// PayDunya channels (amounts in XOF, last 30 days)
export const paymentMethods: PaymentMethodShare[] = [
  { method: 'Orange Money', amount: 1_890_000 },
  { method: 'Wave', amount: 1_420_000 },
  { method: 'MTN MoMo', amount: 720_000 },
  { method: 'Moov Money', amount: 480_000 },
  { method: 'Carte bancaire', amount: 340_000 },
];

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const recentActivities: DashboardActivity[] = [
  { id: '1', type: 'community', actor: 'Awa Ndiaye', action: 'a créé la communauté', target: 'Dakar Data Women', at: minutesAgo(4) },
  { id: '2', type: 'payment', actor: 'Kofi Mensah', action: 'a souscrit un abonnement', target: '15 000 FCFA · Lagos AI & Data', at: minutesAgo(22) },
  { id: '3', type: 'member', actor: 'Aïcha Traoré', action: 'a rejoint', target: 'Python Africa Core', at: minutesAgo(48) },
  { id: '4', type: 'report', actor: 'Modération', action: 'a masqué une publication signalée', target: 'Solidity & Web3 Africa', at: minutesAgo(95) },
  { id: '5', type: 'post', actor: 'Chidi Okafor', action: 'a publié', target: 'Fine-tuning de LLMs en yoruba', at: minutesAgo(180) },
  { id: '6', type: 'member', actor: 'Jean-Luc Habimana', action: 'a été nommé modérateur de', target: 'Kigali Green & Embedded', at: minutesAgo(60 * 6) },
  { id: '7', type: 'login', actor: 'Fatou Sow', action: "s'est connectée à l'administration", target: null, at: minutesAgo(60 * 20) },
  { id: '8', type: 'payment', actor: 'Moussa Diallo', action: 'a été remboursé', target: '20 000 FCFA · AfriCode Mentorship', at: minutesAgo(60 * 30) },
];
