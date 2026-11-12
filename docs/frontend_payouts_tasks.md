# Tâches Frontend : Demandes de Paiement et Backoffice Administrateur

Ce document détaille l'ensemble des tâches et spécifications à implémenter côté frontend (`apps/web`) pour finaliser la fonctionnalité de demande de paiement (reversement des revenus des créateurs de communautés) et sa gestion dans le backoffice administrateur.

---

## 1. Mises à jour des Types TypeScript (`apps/web/src/utils/api/billing/billing.type.ts`)

Mettre à jour les types pour refléter les nouveaux champs de traçabilité, les frais de plateforme Kodinga (2%) et le nouveau statut `failed`.

```typescript
export type PayoutStatus = 'pending' | 'approved' | 'processed' | 'rejected' | 'failed';
export type PayoutMethod = 'wave' | 'orange_money' | 'paydunya' | 'bank_transfer';

export type CommunityPayout = {
  id: string;
  community_id?: string;
  community_name?: string;
  community_slug?: string;
  requested_by_username?: string;
  requested_by_email?: string;
  amount: string; // Montant brut réservé (FCFA)
  fee_amount: string; // Frais de plateforme Kodinga 2% (FCFA)
  net_amount: string; // Montant net reversé au bénéficiaire (FCFA)
  currency: string; // XOF
  status: PayoutStatus;
  payment_method: PayoutMethod;
  account_identifier: string; // Ex: Numéro Wave/Orange Money ou compte PayDunya
  account_name: string;
  reference: string; // Référence externe PayDunya
  processed_at: string | null;
  processed_by_username?: string | null;
  rejection_reason: string;
  admin_note?: string;
  created_at: string;
  updated_at?: string;
};

export type AdminPayoutsSummary = {
  pending_count: number;
  pending_amount: string;
  processed_count: number;
  processed_amount: string;
  fees_collected: string;
};

export type AdminPayoutsResponse = {
  results: CommunityPayout[];
  summary: AdminPayoutsSummary;
  next?: string | null;
  previous?: string | null;
};
```

---

## 2. Espace Créateur : Modal de Retrait (`apps/web/src/pages/community-space/payments/modals/payout-modal.tsx`)

### Améliorations attendues :
1. **Affichage transparent des frais 2% Kodinga** :
   - Dès que le créateur saisit un montant (ex : 40 000 FCFA), calculer et afficher dynamiquement :
     - Frais de service Kodinga (2%) : `- 800 FCFA`
     - **Montant net que vous recevrez : 39 200 FCFA**
2. **Bouton « Tout retirer »** :
   - Ajout d'un bouton d'action rapide à côté du champ montant permettant de remplir directement le solde disponible total.
3. **Moyens de paiement pris en charge** :
   - Wave (`wave`)
   - Orange Money (`orange_money`)
   - Compte PayDunya (`paydunya`)
   - Virement bancaire (`bank_transfer`)
4. **Validation UX** :
   - Montant minimum : 1 000 FCFA.
   - Montant maximum : solde disponible (`available_balance`).
   - Anti-double clic : désactiver le bouton de validation pendant la soumission (`isSubmitting`).
   - Message de confirmation après création : *"Demande enregistrée. Le montant a été réservé et le virement sera exécuté sous 24-48h."*

---

## 3. Espace Créateur : Tableau des Demandes (`apps/web/src/pages/community-space/payments/tables/payouts-table.tsx`)

### Améliorations attendues :
1. **Colonnes détaillées** :
   - **Date** de la demande.
   - **Montant brut** demandé (`amount`).
   - **Frais Kodinga (2%)** (`fee_amount`).
   - **Montant net** versé (`net_amount`).
   - **Bénéficiaire** : Moyen (`Wave`, `Orange Money`, `PayDunya`) + Identifiant/numéro masqué si nécessaire.
   - **Statut** : Badge stylisé :
     - `pending` : Jaune / Ambre (« En attente »)
     - `approved` : Bleu (« Validé »)
     - `processed` : Vert (« Effectué ») + référence de transaction PayDunya au survol ou en sous-titre
     - `rejected` : Rouge (« Refusé ») + affichage du motif de refus
     - `failed` : Rouge foncé (« Échoué ») + motif d'échec
2. **Badge et infobulle d'aide** :
   - Si la demande est rejetée ou a échoué, afficher clairement la mention : *"Votre solde disponible a été automatiquement re-crédité."*

---

## 4. Backoffice Administrateur : Gestion des Demandes de Reversement

### A. Endpoints RTK Query à ajouter dans l'API Frontend (`billing.api.ts` ou `adminBilling.api.ts`)

```typescript
// 1. Lister toutes les demandes de reversement avec filtres et KPIs
getAdminPayouts: builder.query<AdminPayoutsResponse, {
  status?: string;
  community?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  cursor?: string;
}>({
  query: (params) => ({
    url: 'billing/admin/payouts/',
    method: 'GET',
    params,
  }),
  providesTags: ['AdminPayouts'],
}),

// 2. Approuver une demande
approvePayout: builder.mutation<CommunityPayout, { payoutId: string; admin_note?: string }>({
  query: ({ payoutId, admin_note }) => ({
    url: `billing/admin/payouts/${payoutId}/approve/`,
    method: 'POST',
    body: { admin_note },
  }),
  invalidatesTags: ['AdminPayouts'],
}),

// 3. Rejeter une demande avec motif obligatoire
rejectPayout: builder.mutation<CommunityPayout, { payoutId: string; reason: string; admin_note?: string }>({
  query: ({ payoutId, reason, admin_note }) => ({
    url: `billing/admin/payouts/${payoutId}/reject/`,
    method: 'POST',
    body: { reason, admin_note },
  }),
  invalidatesTags: ['AdminPayouts'],
}),

// 4. Décaisser via PayDunya
disbursePayout: builder.mutation<CommunityPayout, { payoutId: string; admin_note?: string }>({
  query: ({ payoutId, admin_note }) => ({
    url: `billing/admin/payouts/${payoutId}/disburse/`,
    method: 'POST',
    body: { admin_note },
  }),
  invalidatesTags: ['AdminPayouts'],
}),
```

### B. Interface du Backoffice Administrateur (`/admin/payouts`)

1. **Bandeau de KPIs en haut de page** :
   - Demandes en attente : Nombre + Montant total cumulé (FCFA)
   - Paiements déjà traités : Nombre + Montant total décaissé (FCFA)
   - Commissions Kodinga perçues (2%) : Montant total généré (FCFA)
2. **Barre d'outils et filtres** :
   - Sélecteur de statut : *Tous*, *En attente*, *Approuvé*, *Effectué*, *Refusé*, *Échoué*.
   - Recherche globale : Nom de communauté, Nom/Email du créateur, Numéro/Compte, Référence.
   - Filtre par date.
3. **Tableau des demandes administratives** :
   - Colonnes :
     - ID & Date
     - Communauté (avec lien vers la communauté)
     - Créateur (Nom, Email, Username)
     - Montant Brut
     - Frais 2%
     - Montant Net à décaisser
     - Moyen & Coordonnées (ex: `Wave: 77 123 45 67`)
     - Statut actuel
     - Actions
4. **Actions administratives avec dialogues de confirmation** :
   - **Bouton « Valider / Approuver »** : Confirme la demande (statut passe à `approved`).
   - **Bouton « Décaisser via PayDunya »** :
     - Boîte de dialogue récapitulative : *"Vous allez envoyer un virement PayDunya de **[Net Amount] FCFA** vers le numéro **[Account Identifier]** (Moyen : **[Method]**). Confirmer le transfert ?"*
     - Envoi de la requête `POST billing/admin/payouts/:id/disburse/`.
     - Toast de succès avec la référence de transaction.
   - **Bouton « Rejeter »** :
     - Boîte de dialogue modale avec champ obligatoire : *"Motif du refus (visible par le créateur)"*.
     - Avertissement : *"Le montant brut sera immédiatement restitué sur le solde disponible de la communauté."*
     - Envoi de la requête `POST billing/admin/payouts/:id/reject/`.

