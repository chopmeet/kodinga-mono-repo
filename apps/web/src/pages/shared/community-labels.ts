// Labels shared by the admin community details and the community space (/c/:slug)
import type { MemberRole, MemberStatus, PaymentStatus, PostType } from '@/data/admin-community-details.data';
import type { BillingInterval, SubscriptionStatus } from '@/data/community-billing.data';

export const memberRoleLabel: Record<MemberRole, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  moderator: 'Modérateur',
  member: 'Membre',
};

export const memberStatusStyle: Record<MemberStatus, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  pending: { label: 'En attente', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  suspended: { label: 'Suspendu', className: 'border-orange-200 bg-orange-50 text-orange-800' },
  banned: { label: 'Banni', className: 'border-red-200 bg-red-50 text-red-700' },
  rejected: { label: 'Refusé', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  left: { label: 'Parti', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

export const postTypeLabel: Record<PostType, string> = {
  discussion: 'Discussion',
  question: 'Question',
  project_showcase: 'Projet',
  poll: 'Sondage',
  announcement: 'Annonce',
};

export const paymentStatusStyle: Record<PaymentStatus, { label: string; className: string }> = {
  PAID: { label: 'Payé', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  PENDING: { label: 'En attente', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  PROCESSING: { label: 'En cours', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  FAILED: { label: 'Échec', className: 'border-red-200 bg-red-50 text-red-700' },
  CANCELLED: { label: 'Annulé', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

export const subscriptionStatusStyle: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  trialing: { label: 'Essai', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  past_due: { label: 'Impayé', className: 'border-red-200 bg-red-50 text-red-700' },
  canceled: { label: 'Résilié', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  expired: { label: 'Expiré', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

export const intervalLabel: Record<BillingInterval, { label: string; suffix: string }> = {
  month: { label: 'Mensuel', suffix: '/ mois' },
  year: { label: 'Annuel', suffix: '/ an' },
  one_time: { label: 'Paiement unique', suffix: 'une fois' },
};

export const xof = (value: number) => `${value.toLocaleString('fr-FR')} FCFA`;
