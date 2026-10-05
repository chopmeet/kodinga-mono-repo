# KODINGA BACKEND IMPLEMENTATION PLAN

## Phase 1 : Fondations, Abstractions Communes & Authentification (EN COURS)
1. **Infrastructure & Configuration**
   - Mise à jour des dépendances (`pyproject.toml` : DRF, SimpleJWT, Celery, Redis, drf-spectacular, cors-headers, django-filter, pytest-django, factory-boy).
   - Configuration centralisée [config/settings.py](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/config/settings.py).
   - Intégration de Celery, Redis, SMTP, CORS et Spectacular OpenAPI.
2. **Abstractions Communes (`common`)**
   - `BaseModel` (UUID4, timestamps, soft-delete optionnel).
   - `BaseCRUDViewSet` & `BaseCRUDService` pour l'unification des CRUD futurs.
   - `EmailService` centralisé pour l'envoi de mails transactionnels dynamiques avec templates HTML/TXT.
   - Gestionnaire d'erreurs standardisé et helpers de réponse JSON.
3. **Domaine Authentification & Comptes (`apps/accounts`)**
   - Modèles : `User`, `UserSession`, `AuthToken`, `OAuthIdentity`, `UserConsent`, `SecurityEvent`.
   - Serializers : `RegisterSerializer`, `LoginSerializer`, `UserSerializer`, `EmailVerificationSerializer`, `PasswordResetSerializer`, `SessionSerializer`, `OAuthSerializer`.
   - Services : `RegistrationService`, `AuthenticationService`, `EmailVerificationService`, `PasswordResetService`, `SessionService`, `OAuthService`.
   - Endpoints complets `/api/v1/auth/*` et `/api/v1/users/me/`.
   - Templates d'emails HTML & Texte (`verification`, `password_reset`, `welcome`, `security_alert`).
   - Tests unitaires et d'intégration complets.

## Phase 2 : Profils Développeurs & Gestion des Médias
1. Profils développeurs (`apps/profiles`) : Bio, avatar, compétences, technologies, liens sociaux.
2. Médias (`apps/media`) : Intégration UploadThing (documents/images) & Mux (vidéos de formation/replays).

## Phase 3 : Communautés & Adhésions Multi-Tenant
1. Espaces communautaires (`apps/communities`) : Espaces publics/privés, règles, catégories.
2. Adhésions & RBAC (`apps/memberships`) : Rôles communautaires (Owner, Admin, Moderator, Member), invitations, modération des membres.

## Phase 4 : Feed Social, Publications & Interactions
1. Feed communautaire (`apps/posts`) : Posts multimédia, blocs de code, catégories, commentaires arborescents, réactions, sondages, épinglage.

## Phase 5 : Monétisation & Facturation
1. Plans d'adhésion & Abonnements (`apps/billing`) : Stripe/Provider abstraction, webhooks vérifiés, synchronisation des statuts de membre, factures.

## Phase 6 : Classroom & Formations
1. Cours & Leçons (`apps/classroom`) : Modules, streaming vidéo Mux, progression par leçon, déblocage séquentiel.

## Phase 7 : Événements & Salles Live
1. Événements programmés (`apps/events`) : Calendrier, rappels, fuseaux horaires.
2. Salons LiveKit (`apps/live`) : Sessions interactives, attribution de tokens vidéo temps réel.

## Phase 8 : Gamification, Découverte & Notifications
1. Système de points, niveaux et badges (`apps/gamification`).
2. Moteur de recherche et découverte de communautés (`apps/discovery`).
3. Notifications in-app et push (`apps/notifications`).

## Phase 9 : Messagerie, Affiliation, Projets & Opportunités
1. Messagerie privée directe (`apps/messaging`).
2. Programme d'affiliation créateur (`apps/affiliates`).
3. Vitrine projets et hackathons tech (`apps/projects`, `apps/challenges`, `apps/opportunities`).

## Phase 10 : Administration Globale & Optimisation de Production
1. Super-administration, dashboards d'analytique (`apps/analytics`, `apps/administration`).
2. Optimisations PostgreSQL (index composite, requêtes optimisées), cache Redis fin et monitoring.
