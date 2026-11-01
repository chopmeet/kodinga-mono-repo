// Mock data for the admin "Paramètres" tab. Categories reuse the shape of the api
// CommunityCategory (+ is_active / communities count an admin endpoint would return).
import type { CommunityCategory } from '@/utils/api/community/community.type';
import { adminCategories, adminCommunities } from './admin-communities.data';

export type PlatformSettings = {
  platform_name: string;
  support_email: string;
  default_language: 'fr' | 'en';
  registrations_open: boolean;
  require_email_verification: boolean;
  /** Plugged to the api: community_creation_allowed_for */
  community_creation: 'all' | 'pro_only';
};

export type AdminCategory = CommunityCategory & {
  is_active: boolean;
  communities_count: number;
};

export type PaymentChannel = {
  id: 'orange_money' | 'wave' | 'mtn_momo' | 'moov_money' | 'card';
  label: string;
  enabled: boolean;
};

export type MonetizationSettings = {
  /** Stored by the api (system setting pro_monthly_price) */
  pro_monthly_price: number;
  commission_rate: number;
  min_monthly_price: number;
  currency: 'XOF';
  payout_delay_days: number;
  channels: PaymentChannel[];
};

export type LegalPageId = 'terms' | 'privacy' | 'refund';

export type LegalPage = {
  id: LegalPageId;
  title: string;
  /** HTML (edited with the rich text editor) */
  content: string;
  updated_at: string;
};

export const platformSettings: PlatformSettings = {
  platform_name: 'Kodinga',
  support_email: 'support@kodinga.com',
  default_language: 'fr',
  registrations_open: true,
  require_email_verification: true,
  community_creation: 'all',
};

export const settingsCategories: AdminCategory[] = adminCategories.map((c) => ({
  ...c,
  description: c.description || `Communautés ${c.name}`,
  is_active: true,
  communities_count: adminCommunities.filter((community) => community.category?.slug === c.slug).length,
}));

export const monetizationSettings: MonetizationSettings = {
  pro_monthly_price: 5_000,
  commission_rate: 10,
  min_monthly_price: 2_000,
  currency: 'XOF',
  payout_delay_days: 7,
  channels: [
    { id: 'orange_money', label: 'Orange Money', enabled: true },
    { id: 'wave', label: 'Wave', enabled: true },
    { id: 'mtn_momo', label: 'MTN MoMo', enabled: true },
    { id: 'moov_money', label: 'Moov Money', enabled: true },
    { id: 'card', label: 'Carte bancaire', enabled: false },
  ],
};

export const legalPages: Record<LegalPageId, LegalPage> = {
  terms: {
    id: 'terms',
    title: "Conditions générales d'utilisation",
    updated_at: '2026-09-15T10:00:00Z',
    content:
      '<h2>1. Objet</h2><p>Kodinga met en relation des développeurs au sein de communautés thématiques. Les présentes conditions encadrent l’utilisation de la plateforme.</p>' +
      '<h2>2. Compte</h2><p>Chaque membre est responsable de la confidentialité de ses identifiants et des contenus qu’il publie.</p>' +
      '<h2>3. Communautés payantes</h2><p>Les abonnements sont réglés via PayDunya (Mobile Money ou carte). Kodinga prélève une commission sur chaque paiement.</p>',
  },
  privacy: {
    id: 'privacy',
    title: 'Politique de confidentialité',
    updated_at: '2026-08-02T10:00:00Z',
    content:
      '<h2>Données collectées</h2><p>Nom, adresse email, ville et activité sur la plateforme (publications, adhésions).</p>' +
      '<h2>Utilisation</h2><p>Ces données servent au fonctionnement du service et ne sont jamais revendues.</p>' +
      '<h2>Vos droits</h2><p>Vous pouvez demander l’accès, la rectification ou la suppression de vos données à support@kodinga.com.</p>',
  },
  refund: {
    id: 'refund',
    title: 'Politique de remboursement',
    updated_at: '2026-07-20T10:00:00Z',
    content:
      '<h2>Délai</h2><p>Un abonnement peut être remboursé dans les 7 jours suivant le premier paiement.</p>' +
      '<h2>Procédure</h2><p>La demande se fait depuis l’espace membre ; le remboursement est versé sur le moyen de paiement d’origine.</p>',
  },
};
