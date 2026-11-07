# Kodinga - Cahier des charges exhaustif & Backlog d'intégration Frontend

Ce document constitue la **feuille de route exhaustive** pour l'équipe Frontend (`apps/web`). Il regroupe l'ensemble des fonctionnalités implémentées, testées et prêtes côté Backend (`apps/api`), réparties entre :
1. **Les fonctionnalités actuellement affichées "Bientôt disponible"** dans l'UI (déblocage immédiat).
2. **Les fonctionnalités majeures prêtes côté API** mais nécessitant la création de nouveaux écrans ou composants (Événements Live & IA, Gamification, Analytics, Opportunités, Churn & Mentors).

---

## 🚨 PARTIE 1 : Déblocage immédiat des fonctionnalités affichées "Bientôt"

| Fonctionnalité | Composant Frontend cible | Endpoint Backend | Méthode & Données |
| :--- | :--- | :--- | :--- |
| **Calendrier / Heatmap annuelle** | `apps/web/src/pages/authenticated/profile/public-profile.tsx:167` | `/api/v1/profiles/{username}/activity/?year={YYYY}` | `GET`<br>Renvoie la liste des 365 jours avec `date`, `count`, `level` |
| **Filtre Membres "En ligne"** | `apps/web/src/components/organisms/members/members-tab.tsx:129` | `/api/v1/communities/{slug}/members/?online=true` | `GET`<br>Chaque membre renvoie `is_online: boolean` |
| **Filtre Posts "Verrouillés"** | `apps/web/src/components/organisms/community-posts/community-posts.tsx:98` | `/api/v1/posts/?community={slug}&locked=true` | `GET`<br>Permet d'isoler les contenus exclusifs/abonnés |
| **Dissocier un projet** | `apps/web/src/components/organisms/projects/row-actions.tsx:56` | `/api/v1/projects/{slug}/` | `PATCH`<br>Payload : `{ "community": null }` |
| **Portefeuille & Solde Créateur** | `apps/web/src/pages/authenticated/community/community-overview.tsx:27` | `/api/v1/communities/{slug}/billing/wallet/` | `GET`<br>Renvoie `available_balance`, `pending_balance`, `currency` |
| **Demande de Virement (Payout)**| `apps/web/src/pages/authenticated/community/payments.tsx:16` | `/api/v1/communities/{slug}/billing/payouts/` | `POST`<br>`{ "amount": "50000.00", "payout_method": "orange_money", "account_identifier": "..." }` |

---

## 🎟️ PARTIE 2 : Événements LiveKit, Calendrier & Intelligence Artificielle

L'application `apps/events` dispose d'un écosystème événementiel complet avec vidéo en direct et post-traitement IA.

### 1. Export Calendrier (.ics)
- **Endpoint** : `GET /api/v1/communities/{slug}/events/{event_id}/calendar.ics`
- **Action UI** : Bouton **"Ajouter à mon agenda"** (compatible Google Calendar, Outlook, Apple Calendar) sur la fiche événement.

### 2. Live streaming & Visioconférence (LiveKit)
- **Endpoint** : `POST /api/v1/communities/{slug}/events/{event_id}/join-live/`
- **Réponse API** : `{ "token": "...", "room_name": "...", "server_url": "..." }`
- **Action UI** : Ouvrir la salle de visio LiveKit en injectant le token de participation pour les membres inscrits.

### 3. Suite IA Post-Événement (Replay & Transcription)
- **Endpoints disponibles** :
  - `POST /api/v1/communities/{slug}/events/{event_id}/transcribe/` : Lance la transcription automatique du replay vidéo.
  - `GET /api/v1/communities/{slug}/events/{event_id}/transcription/` : Récupère la transcription intégrale chapitrée.
  - `POST /api/v1/communities/{slug}/events/{event_id}/summary/` : Génère le résumé exécutif de l'événement et les points clés à retenir.
  - `POST /api/v1/communities/{slug}/events/{event_id}/chat-transcript/` : **"Discuter avec le replay"** : L'apprenant pose une question sur la vidéo ("À quel moment l'intervenant a parlé de Docker ?") et l'IA répond avec le minutage exact.

---

## 🏆 PARTIE 3 : Gamification avancée & Administration communautaire

L'application `apps/gamification` permet aux créateurs de piloter entièrement l'engagement de leur communauté.

### 1. Position instantanée dans le classement (Leaderboard)
- **Endpoint** : `GET /api/v1/communities/{slug}/gamification/leaderboard/me/`
- **Réponse API** : `{ "rank": 4, "points": 1250, "next_tier_points": 1500, "points_to_next_rank": 250 }`
- **Action UI** : Widget affichant la position du membre sans devoir chercher dans les pages du classement.

### 2. Configuration du barème de points par le Créateur
- **Endpoints** :
  - `GET /api/v1/communities/{slug}/gamification/rules/` : Liste des règles de points actives (création de post, commentaire, cours validé...).
  - `PUT /api/v1/communities/{slug}/gamification/rules/{action}/` : Mise à jour du nombre de points attribués pour une action donnée.
  - `GET /api/v1/communities/{slug}/gamification/rules/history/` : Historique des modifications du barème.
- **Action UI** : Écran d'administration des paramètres de la communauté > Onglet "Gamification & Points".

### 3. Ajustement manuel & Journal des transactions
- **Endpoints** :
  - `POST /api/v1/communities/{slug}/gamification/points/adjust/` :
    `{ "user_id": "...", "points": 50, "reason": "Aide précieuse sur le hackathon" }`
  - `GET /api/v1/communities/{slug}/gamification/transactions/` : Table d'audit de toutes les attributions de points de la communauté.

---

## 💼 PARTIE 4 : Opportunités professionnelles & Recrutement

L'application `apps/opportunities` gère les offres d'emploi, de stage et de freelance.

### 1. Espace Candidat
- **Endpoint** : `GET /api/v1/opportunities/my-applications/`
- **Données** : Statut de chaque candidature (`submitted`, `reviewing`, `shortlisted`, `rejected`, `accepted`), date et message du recruteur.
- **Action UI** : Page "Mes candidatures" dans le tableau de bord de l'utilisateur.

### 2. Espace Recruteur / Créateur d'offre
- **Endpoints** :
  - `GET /api/v1/opportunities/{slug}/applications/` : Liste de tous les candidats ayant postulé à l'offre avec CV et profil.
  - `PATCH /api/v1/opportunities/applications/{application_id}/status/` :
    Payload : `{ "status": "shortlisted", "notes": "Entretien prévu mardi" }`
- **Action UI** : Tableau de bord kanban ou table de suivi des candidatures par offre.

---

## 📊 PARTIE 5 : Tableaux de bord d'activité & Analytics Membre

L'application `apps/analytics` fournit une vue synthétique des réalisations de l'utilisateur.

- **Endpoints disponibles** :
  - `GET /api/v1/analytics/member/dashboard/` : Synthèse globale du portfolio de l'utilisateur (cours complétés, hackathons remportés, événements suivis).
  - `GET /api/v1/communities/{slug}/me/dashboard/` : Même vue personnalisée et filtrée pour la communauté en cours de consultation.
  - `GET /api/v1/communities/{slug}/me/courses/` : Avancement dans les cours de la communauté.
  - `GET /api/v1/communities/{slug}/me/events/` : Historique de présence aux événements de la communauté.
- **Action UI** : Onglet "Mon activité / Mon bilan" sur le profil ou dans la communauté.

---

## 🤖 PARTIE 6 : Intelligence Artificielle & Rétention communautaire

### 1. Entraide technique intelligente & Alerte Mentors
- **Endpoints** :
  - `GET /api/v1/posts/{post_id}/help-assistance/` : L'IA analyse un post technique sans réponse et fournit une ébauche de solution ou des pistes de documentation.
  - `POST /api/v1/posts/{post_id}/help-assistance/ping-mentors/` : Permet à l'auteur d'alerter les mentors compétents de la communauté si la réponse IA ne suffit pas.

### 2. Prévention du désengagement (Churn Management pour Community Managers)
- **Endpoint** : `POST /api/v1/ai/churn-risks/{churn_id}/generate-nudge/`
- **Action** : L'IA rédige un message personnalisé et bienveillant pour réengager un membre inactif en lui proposant des contenus récents adaptés à ses centres d'intérêt.
- **Action UI** : Bouton "Générer un message de relance" dans l'onglet des membres inactifs du panel admin de la communauté.

### 3. Outils IA Créateur & Traduction
- **Assistant de création de communauté** : `POST /api/v1/ai-assistant/plan-community/`
- **Générateur d'idées de contenu** : `POST /api/v1/ai-assistant/suggest-content/`
- **Recommandations de communautés** : `POST /api/v1/ai-assistant/recommend-communities/`
- **Détection de doublons en live** : `POST /api/v1/communities/{slug}/ai/check-duplicates/`
- **Recherche sémantique vectorielle** : `GET /api/v1/communities/{slug}/ai/semantic-search/?q=...`
- **Traduction multilingue & langues africaines** : `GET /api/v1/languages/` et `POST /api/v1/translate/`

---

## 🤝 PARTIE 7 : Affiliation, Parrainage & Favoris

### 1. Affiliation Kodinga Pro
- **Endpoint clic affilié** : `POST /api/v1/affiliates/track-click/` avec `{ "referral_code": "..." }` (à appeler automatiquement quand l'utilisateur arrive sur Kodinga via un lien `/ref/{code}`).
- **Dashboard Affilié** : `GET /api/v1/affiliates/me/` (statistiques de clics, conversions et gains).
- **Historique des commissions** : `GET /api/v1/affiliates/commissions/`.

### 2. Publications sauvegardées
- **Liste des favoris** : `GET /api/v1/posts/bookmarks/`
- **Ajout/Suppression** : `POST /api/v1/posts/{id}/bookmark/`

---

## 🔒 PARTIE 8 : Sécurité, RGPD & Santé Système

- **Consentements RGPD** : `GET /api/v1/users/me/consents/` et `PUT /api/v1/users/me/consents/` (gestion des cookies, communications marketing et tracking).
- **Audit Logs d'administration** : `GET /api/v1/admin/audit-logs/` (traçabilité des actions des administrateurs).
- **Santé des services IA** : `GET /api/v1/admin/ai/health/` (monitoring des quotas et modèles Gemini / OpenAI).

---

## 🎯 Ordre de mission conseillé pour le Développeur Frontend

1. **Sprint 1 (Quick wins - 1 à 2 jours)** :
   - Débloquer les 5 placeholders "Bientôt" (Heatmap profil, filtre membres en ligne, filtre posts verrouillés, dissociation de projet, wallet/retraits).
   - Brancher l'export calendrier `.ics` sur la fiche des événements.
   - Activer la sauvegarde de posts (Bookmarks).

2. **Sprint 2 (Social & Gamification - 3 à 4 jours)** :
   - Brancher Follow / Unfollow et listes d'abonnés sur les profils.
   - Intégrer le widget "Ma position" dans le classement communautaire (`leaderboard/me/`).
   - Mettre en place l'espace "Mes candidatures" (`opportunities/my-applications/`).

3. **Sprint 3 (Expérience IA & Événements Live - 4 à 5 jours)** :
   - Intégrer la traduction instantanée des messages et posts (`/api/v1/translate/`).
   - Intégrer les suggestions d'idées de contenu pour les créateurs.
   - Brancher le salon visio LiveKit (`join-live/`) et l'accès au résumé/transcription IA des événements.
   - Brancher l'espace d'affiliation et le tracking des parrainages (`track-click/`).
