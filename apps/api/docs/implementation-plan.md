# KODINGA BACKEND IMPLEMENTATION PLAN

## Phase 1 : Fondations, Abstractions Communes & Authentification (TERMINE)
1. **Infrastructure & Configuration**
   - Dépendances centralisées (`pyproject.toml` : DRF, SimpleJWT, Celery, Redis, drf-spectacular, cors-headers, django-filter, pytest-django, factory-boy).
   - Configuration centralisée [config/settings.py](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/config/settings.py).
   - Intégration de Celery, Redis, SMTP, CORS et Spectacular OpenAPI.
2. **Abstractions Communes (`common`)**
   - `BaseModel` (UUID4, timestamps, soft-delete optionnel).
   - `BaseCRUDViewSet` & `BaseCRUDService` pour l'unification des CRUD.
   - `EmailService` centralisé pour l'envoi de mails transactionnels dynamiques avec templates HTML/TXT.
   - Gestionnaire d'erreurs standardisé et helpers de réponse JSON.
3. **Domaine Authentification & Comptes (`apps/accounts`)**
   - Modèles : `User`, `UserSession`, `AuthToken`, `OAuthIdentity`, `UserConsent`, `SecurityEvent`.
   - Serializers : `RegisterSerializer`, `LoginSerializer`, `UserSerializer`, `EmailVerificationSerializer`, `PasswordResetSerializer`, `SessionSerializer`, `OAuthSerializer`.
   - Services : `RegistrationService`, `AuthenticationService`, `EmailVerificationService`, `PasswordResetService`, `SessionService`, `OAuthService`.
   - Endpoints complets `/api/v1/auth/*` et `/api/v1/users/me/`.
   - Templates d'emails HTML & Texte (`verification`, `password_reset`, `welcome`, `security_alert`).
   - Tests unitaires et d'intégration validés.

## Phase 2 : Profils Développeurs & Gestion des Médias (TERMINE)
1. **Profils développeurs (`apps/profiles`)**
   - Modèles : `DeveloperProfile`, `Technology`, `DeveloperSkill`, `DeveloperExperience`, `DeveloperEducation`, `DeveloperPortfolioProject`.
   - Auto-création de profil via signal post-save `User`.
   - Selectors & Services : `ProfileSelector` (prefetchs optimisés, recherche multicritère), `ProfileService` (mise à jour profil, gestion des compétences, parcours, diplômes, projets).
   - Endpoints complets :
     - `/api/v1/profiles/me/` (GET / PATCH / PUT)
     - `/api/v1/profiles/me/skills/`, `/api/v1/profiles/me/skills/<id>/` (CRUD compétences)
     - `/api/v1/profiles/me/experiences/`, `/api/v1/profiles/me/experiences/<id>/` (CRUD expériences)
     - `/api/v1/profiles/me/educations/`, `/api/v1/profiles/me/educations/<id>/` (CRUD formations)
     - `/api/v1/profiles/me/portfolio/`, `/api/v1/profiles/me/portfolio/<id>/` (CRUD projets)
     - `/api/v1/profiles/technologies/` (Catalogue & autocomplétion technologies)
     - `/api/v1/profiles/` & `/api/v1/profiles/<username>/` (Annuaire public & profils détaillés avec incrément des vues)
2. **Médias & Vidéos (`apps/media`)**
   - Intégration UploadThing / Stockage d'assets : `MediaAsset` (avatars, bannières, documents, attachments) avec URLs pré-signées sécurisées (`POST /api/v1/media/upload-url/`, `POST /api/v1/media/confirm-upload/`).
   - Intégration Mux Video VoD & Live Streaming : `VideoAsset` avec direct upload (`POST /api/v1/media/videos/upload-url/`), URLs de lecture HLS adaptatives (`https://stream.mux.com/<id>.m3u8`), posters et GIFs animés, et gestionnaire de webhooks asynchrones avec vérification de signature HMAC SHA256 (`POST /api/v1/media/mux/webhook/`).
   - Tests d'intégration et unitaires validés (100% pass).

## Phase 3 : Communautés & Adhésions Multi-Tenant (TERMINE)
1. **Espaces communautaires (`apps/communities`)**
   - Modèles : `Community`, `CommunityCategory`, `CommunitySettings`, `CommunityRule`.
   - Confidentialité (`public`, `private`, `secret`), types de tarification (`free`, `paid`), branding et compteurs dénormalisés.
   - Paramètres modulaires (`CommunitySettings`) : contrôle des invitations, approbation manuelle, permissions de publication, feature toggles.
   - Charte et règles de communauté (`CommunityRule`) ordonnables.
   - Endpoints :
     - `/api/v1/communities/` (GET explore / POST create)
     - `/api/v1/communities/my/` (GET my spaces)
     - `/api/v1/communities/categories/` (GET categories)
     - `/api/v1/communities/<slug>/` (GET / PATCH / DELETE)
     - `/api/v1/communities/<slug>/settings/` (GET / PATCH)
     - `/api/v1/communities/<slug>/rules/`, `.../rules/<id>/` (CRUD règles)
2. **Adhésions & RBAC Multi-Tenant (`apps/memberships`)**
   - Modèles : `CommunityMember`, `CommunityInvitation`, `MemberSanction`.
   - Hiérarchie de rôles : `OWNER`, `ADMIN`, `MODERATOR`, `MEMBER`.
   - Cycle de vie : `ACTIVE`, `PENDING`, `REJECTED`, `SUSPENDED`, `BANNED`, `LEFT`.
   - Système d'invitation sécurisé par token aléatoire cryptographique avec expiration et quota d'usage.
   - Modération et sanctions (`warning`, `mute`, `suspension`, `ban`).
   - Endpoints :
     - `/api/v1/communities/<slug>/join/` & `/api/v1/communities/<slug>/leave/`
     - `/api/v1/communities/<slug>/members/` & `.../members/<id>/` (attribution rôles & validation)
     - `/api/v1/communities/<slug>/members/<id>/sanctions/` (sanctions de modération)
     - `/api/v1/communities/<slug>/invitations/` & `/api/v1/invitations/accept/` (liens d'invitation)
   - Tests d'intégration et unitaires validés (100% pass).

## Phase 4 : Feed Social, Publications & Interactions (TERMINE)
1. **Publications & Canaux (`apps/posts`)**
   - Modèles : `Post`, `PostCategory`, `Comment`, `PostReaction`, `CommentReaction`, `Poll`, `PollOption`, `PollVote`.
   - Types de publications : `discussion`, `question`, `project_showcase`, `poll`, `announcement`.
   - Blocs de code source intégrés avec détection de langage de programmation.
   - Sondages interactifs (`Poll`, `PollOption`, `PollVote`) : choix unique ou multiple, calcul temps réel des pourcentages et historique des votes.
   - Commentaires arborescents hiérarchiques avec validation de la réponse acceptée (`is_accepted_answer`) et attribution automatique de points de réputation (+15).
   - Réactions emoji polymorphiques (`like`, `fire`, `rocket`, `heart`, `eyes`, `thinking`, `unicorn`).
   - Modération : épinglage (`is_pinned`), verrouillage des commentaires (`is_locked`), résolution de questions (`is_resolved`).
   - Endpoints complets :
     - `/api/v1/communities/<slug>/feed/` (GET liste filtrable & recherche / POST nouvelle publication)
     - `/api/v1/communities/<slug>/categories/` (GET canaux / POST création de salon #canal)
     - `/api/v1/posts/<id>/` (GET détails & incrément de vues / PATCH modification / DELETE suppression)
     - `/api/v1/posts/<id>/pin/` (POST épingler / désépingler)
     - `/api/v1/posts/<id>/lock/` (POST verrouiller / déverrouiller)
     - `/api/v1/posts/<id>/react/` (POST ajouter / retirer réaction emoji)
     - `/api/v1/posts/<id>/vote/` (POST enregistrer vote à un sondage)
     - `/api/v1/posts/<id>/comments/` (GET commentaires arborescents / POST ajouter commentaire ou réponse)
     - `/api/v1/comments/<id>/` (DELETE suppression commentaire)
     - `/api/v1/comments/<id>/react/` (POST réaction emoji sur commentaire)
     - `/api/v1/comments/<id>/accept/` (POST valider comme réponse acceptée & attribuer réputation)
   - Tests d'intégration et unitaires validés (100% pass, 48/48 tests réussis).

## Phase 5 : Monétisation & Facturation (PayDunya Sandbox / Live) (TERMINE)
1. **Plans d'adhésion & Abonnements (`apps/billing`)**
   - Intégration officielle **PayDunya** (modes `test` sandbox et `live` production).
   - Passerelle `PayDunyaGateway` : création d'invoices checkout sécurisées et confirmation serveur-à-serveur `GET /checkout-invoice/confirm/{token}` comme unique source de vérité.
   - Modèles de données :
     - `Plan` : Tarification côté serveur (mois/an/unique), devises (XOF, EUR, USD), features JSON, association optionnelle à une `Community`.
     - `Subscription` : Statuts (`PENDING`, `ACTIVE`, `CANCELLED`, `EXPIRED`), dates de début/fin, renouvellement.
     - `Payment` : Historique des transactions, montant, devise, token PayDunya unique, IPN payload auditable, statut interne (`PENDING`, `PAID`, `FAILED`, `CANCELLED`).
     - `Affiliate` & `AffiliateCommission` : Programme d'affiliation avec attribution d'une commission de 50% sur le premier abonnement payé par un filleul, protégée contre les doublons.
   - Sécurité & Idempotence :
     - Tarifs strictement déterminés côté serveur depuis `Plan` (manipulation du prix client impossible).
     - Traitement IPN atomique avec lock de base de données (`select_for_update`) et vérification PayDunya obligatoire.
     - Activation automatique de l'adhésion `CommunityMember` si le plan est lié à une communauté.
   - Endpoints complets :
     - `/api/v1/billing/plans/` (GET liste des plans disponibles)
     - `/api/v1/billing/checkout/` (POST initier session de paiement PayDunya)
     - `/api/v1/billing/ipn/paydunya/` (POST webhook / callback serveur PayDunya)
     - `/api/v1/billing/subscriptions/my/` (GET abonnements de l'utilisateur connecté)
     - `/api/v1/billing/payments/my/` (GET historique des paiements)
     - `/api/v1/billing/payments/<id>/status/` (GET statut sécurisé pour redirection `/payment/success`)
     - `/api/v1/billing/affiliate/` (GET dashboard affilié, lien de parrainage, gains & commissions)
     - `/api/v1/billing/affiliate/join/` (POST activation du statut affilié)
   - Tests validés (100% pass, 7 tests complets couvrant création, confirmation IPN, idempotence, sécurité prix, cross-user privacy, adhésion auto).

## Phase 6 : Classroom & Formations (TERMINE)
1. Cours & Leçons (`apps/classroom`) : Modules, streaming vidéo Mux, progression par leçon, déblocage séquentiel.

## Phase 7 : Événements & Salles Live (TERMINE)
1. Événements programmés (`apps/events`) : Calendrier ICS, rappels par email, inscriptions RSVP.
2. Salons LiveKit interactifs : Sessions temps réel, attribution de jetons JWT sécurisés (`LIVEKIT_API_SECRET`), webhooks temps réel.

## Phase 8 : Gamification, Découverte & Notifications (TERMINE)
1. Système de points, niveaux et badges (`apps/gamification`) : Classements global et par communauté, historique de réputation.
2. Moteur de recherche et découverte (`apps/discovery`) : Recherche unifiée et flux tendance.
3. Notifications in-app (`apps/notifications`) : Cycle de vie lu/non lu, décompte en temps réel.

## Phase 9 : Messagerie, Affiliation, Projets & Opportunités (TERMINE)
1. Messagerie privée directe (`apps/messaging`) : Conversations 1-to-1 et de groupe, pièces jointes.
2. Programme d'affiliation créateur (`apps/affiliates`) : Génération de liens, traçage des clics et demandes de retrait (payouts).
3. Vitrine projets et opportunités tech (`apps/projects`, `apps/opportunities`) : Showcases, upvotes, offres d'emploi/missions et candidatures.

## Phase 10 : Administration Globale & Optimisation de Production (TERMINE)
1. **Analytique & Statistiques Plateforme (`apps/analytics`)**
   - Modèle `PlatformMetric` avec indexation composite (`['metric_name', 'recorded_at']`, `['metric_type', 'recorded_at']`).
   - Service d'agrégation `AnalyticsService` avec cache Redis fin (TTL 300s) : KPI utilisateurs (DAU, WAU, MAU, ratio DAU/MAU), communautés, contenus, complétion de formations, et monétisation (MRR, devises).
   - Endpoints complets :
     - `GET /api/v1/analytics/overview/` (Vue macroscopique)
     - `GET /api/v1/analytics/financial/` (Ventilation financière)
     - `GET /api/v1/analytics/engagement/` (Activité & rétention)
     - `GET /api/v1/analytics/metrics/` & `POST /api/v1/analytics/metrics/` (Historique et snapshots)
2. **Super-Administration & Gouvernance (`apps/administration`)**
   - Modèles `PlatformAuditLog` et `SystemSetting` avec indexation composite d'audit (`['action', 'created_at']`, `['target_type', 'target_id']`).
   - Service `AdministrationService` : Journalisation d'audit systématique, bilan de santé système (PostgreSQL, Redis, Storage) avec mesure de latence en temps réel, activation/suspension d'utilisateurs et promotion superadmin.
   - Endpoints complets :
     - `GET /api/v1/admin/dashboard/` (Synthèse superadmin avec 10 derniers logs d'audit)
     - `GET /api/v1/admin/audit-logs/` (Journal d'audit filtrable par action et cible)
     - `GET /api/v1/admin/system/health/` (Santé des composants PostgreSQL, Redis, Storage)
     - `GET /api/v1/admin/settings/` & `PATCH /api/v1/admin/settings/` (Feature flags globaux)
     - `POST /api/v1/admin/users/<id>/toggle-status/` (Activation / suspension de compte)
     - `POST /api/v1/admin/users/<id>/toggle-admin/` (Attribution / révocation privilège superadmin)
3. **Sécurité & Permissions RBAC**
   - Permission `IsPlatformAdmin` stricte (`is_superadmin`, `is_superuser`, `is_staff`).
   - Protection de `UserListView` (`GET /api/v1/users/`) réservée aux administrateurs avec filtres de statut (`active`, `unverified`, `inactive`).
   - Protection de `CommunityMemberListView` (`GET /api/v1/communities/<slug>/members/`) réservée aux propriétaires, modérateurs et superadmins.
4. **Validation des Tests**
   - 100% des tests validés (Phase 1 à Phase 10).
