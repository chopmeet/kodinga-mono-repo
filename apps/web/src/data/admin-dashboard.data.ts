// Mock data for the blocks of the admin dashboard the api does not cover yet (key figures, top
// communities and recent activities come from the api: pages/admin/dashboard/form/UseAdminDashboard.ts).
// TODO(api): monthly growth series, communities by pricing/privacy, payments by PayDunya channel.

export type MonthlyGrowth = {
  month: string;
  newMembers: number;
  posts: number;
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
