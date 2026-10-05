# KODINGA BACKEND ARCHITECTURE & SYSTEM DESIGN

## 1. Vue d'Ensemble

Kodinga est une plateforme SaaS multi-communautaire pour développeurs et professionnels de la technologie. Le backend est bâti sur une architecture modulaire Django REST Framework, avec PostgreSQL comme source de vérité, Redis pour le cache et les sessions/tokens, Celery pour les traitements asynchrones, SimpleJWT pour l'authentification et une stricte isolation multi-tenant.

```
                                  +-----------------------+
                                  |  Next.js Frontend /   |
                                  |    Mobile Clients     |
                                  +-----------+-----------+
                                              | HTTPS / REST / Cookies / JWT
                                              v
                              +---------------+---------------+
                              |    Nginx / Ingress / Proxy    |
                              +---------------+---------------+
                                              |
                                              v
                              +---------------+---------------+
                              |   Gunicorn / WSGI (Django)    |
                              |   /api/v1/*                   |
                              +-------+---------------+-------+
                                      |               |
                  +-------------------+               +-------------------+
                  |                                                       |
                  v                                                       v
      +-----------+-----------+                               +-----------+-----------+
      |  PostgreSQL Database  |                               | Redis (Cache/Broker)  |
      |  (Multi-tenant RBAC)  |                               +-----------+-----------+
      +-----------------------+                                           |
                                                                          v
                                                              +-----------+-----------+
                                                              |  Celery Workers/Beat  |
                                                              |  - Emails / Webhooks  |
                                                              |  - Media Processing   |
                                                              +-----------------------+
```

---

## 2. Organisation Modulaire par Domaines Métier

Le projet est structuré en domaines métier clairs sous `apps/` et un noyau transversal sous `common/` :

```text
apps/api/
├── config/
│   ├── settings.py           # Configuration unique et centralisée (django-environ)
│   ├── urls.py               # Routage racine API v1
│   ├── celery.py             # Configuration Celery & beat
│   ├── asgi.py               # Interface ASGI
│   └── wsgi.py               # Interface WSGI
│
├── apps/
│   ├── accounts/             # Authentification, utilisateurs, sessions, sécurité
│   ├── profiles/             # Profils développeurs, compétences, abonnements
│   ├── communities/          # Espaces communautaires, règles, catégories, settings
│   ├── memberships/          # RBAC communauté, adhésions, invitations
│   ├── posts/                # Feed, commentaires, réactions, sondages
│   ├── classroom/            # Formations, modules, leçons, progression
│   ├── events/               # Calendrier d'événements, inscriptions, rappels
│   ├── live/                 # Sessions interactives LiveKit
│   ├── messaging/            # Messagerie directe temps réel
│   ├── notifications/        # In-app, push & préférences
│   ├── gamification/         # Points, niveaux, leaderboards
│   ├── discovery/            # Recherche globale et recommandation
│   ├── billing/              # Plans, paiements, factures, webhooks
│   ├── affiliates/           # Parrainage et commissions
│   ├── analytics/            # Métriques d'engagement et financières
│   ├── projects/             # Vitrine projets & collaborations
│   ├── challenges/           # Hackathons & coding challenges
│   ├── opportunities/        # Emplois & missions tech
│   ├── moderation/           # Signalements, sanctions, audits
│   ├── administration/       # Super-administration plateforme
│   └── media/                # Intégrations UploadThing (fichiers) & Mux (vidéos)
│
├── common/
│   ├── models/base.py        # BaseModel (UUID, timestamps, soft-delete optionnel)
│   ├── serializers/base.py   # Serializers génériques et validations standard
│   ├── views/base_crud.py    # BaseCRUDViewSet optimisé
│   ├── services/crud.py      # BaseCRUDService générique
│   ├── permissions/base.py   # IsAuthenticated, IsSuperUser, IsOwner, CommunityPermissions
│   ├── exceptions/           # Gestionnaire centralisé d'erreurs (RFC 7807)
│   ├── utils/responses.py    # Enveloppes de réponses standardisées
│   ├── utils/tokens.py       # Génération sécurisée de tokens SHA-256
│   └── services/email_service.py # Service SMTP centralisé avec templates HTML/TXT
│
├── templates/
│   └── emails/               # Templates d'emails transactionnels multilingues
├── tests/                    # Tests d'intégration et suites de validation
├── docs/                     # Documentation d'architecture et de référence
└── manage.py
```

---

## 3. Principes Fondamentaux de Conception

1. **Séparation Stricte des Responsabilités :**
   - **Models** : Données, contraintes d'intégrité, relations, invariants.
   - **Serializers** : Validation des entrées HTTP, sérialisation des sorties.
   - **Views / ViewSets** : Orchestration HTTP, codes de statut, permissions de surface.
   - **Services** : Toute la logique métier, transactions atomiques, effets de bord.
   - **Selectors** : Requêtes de lecture complexes, optimisations SQL (`select_related`, `prefetch_related`, agrégations).
   - **Tasks** : Exécution asynchrone (emails, webhooks, synchronisation média).

2. **Multi-Tenancy & Isolation des Données :**
   - Chaque ressource communautaire référence explicitement `community_id`.
   - Les querysets sont systématiquement filtrés par communauté et rôle de l'utilisateur.
   - Prévention systématique des attaques IDOR via des permissions au niveau de l'objet.

3. **Services Externes Spécialisés :**
   - **UploadThing** : Upload direct sécurisé de documents et images via des URLs pré-signées.
   - **Mux** : Ingestion directe de flux vidéo, transcodage, lecture adaptative HLS sécurisée.
   - **LiveKit** : Salles vidéo interactives en direct (WebRTC) avec génération de tokens éphémères.
   - **SMTP Transactionnel** : Envois asynchrones avec fallback, retries et templates unifiés.
