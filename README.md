# Kodinga

Plateforme de communautés tech pour l'Afrique francophone. Monorepo Nx :

| Dossier | Contenu |
|---|---|
| `apps/web` | Front React (Vite, Tailwind, RTK Query) |
| `apps/api` | API Django REST (PostgreSQL, Redis, Celery, Channels) |
| `libs/ui` | Kit UI partagé, importé via `@kodinga-mono-repo/ui` |
| `deploy` | Stack du VPS et procédure de déploiement |

## Installation

```sh
npm install
```
Lorsqu'une erreur de conflit de dépendances entre pairs bloque l'installation d'un(plusieurs) paquet(s)
```sh
npm install --legacy-peer-deps
```

```sh
cd apps/api && uv sync
```

Copier les fichiers d'environnement :

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

## API

Démarrer la base de données et Redis

```sh
docker compose -p kodinga up -d kodingadb redis
```

Appliquer les migrations

```sh
cd apps/api && uv run python manage.py migrate
```

Remplir les données de base (catégories, formules Kodinga Pro, superadmin)

```sh
cd apps/api
uv run python manage.py seed_categories
uv run python manage.py seed_plans
uv run python manage.py seed_superadmin
```

Démarrer l'API (HTTP et WebSocket sur le port 8000)

```sh
npx nx serve api
```

Démarrer Celery (emails, tâches planifiées)

```sh
cd apps/api
uv run celery -A config worker -l info
uv run celery -A config beat -l info
```

Documentation de l'API (Swagger) : http://localhost:8000/api/docs/

## Front

```sh
npx nx serve web
```

## Tests et lint

```sh
npx nx run-many -t lint test build --projects=web,ui   # front
npx nx lint api                                         # ruff
npx nx test api                                         # pytest
```

## Paiements (PayDunya)

Les clés sandbox vont dans `apps/api/.env` (`PAYDUNYA_MODE=test`, `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`).

PayDunya doit pouvoir joindre l'IPN : en local, exposer l'API avec un tunnel et renseigner l'URL publique.

```sh
ngrok http 8000
# puis dans apps/api/.env :
# PAYDUNYA_CALLBACK_URL=https://<sous-domaine>.ngrok-free.app/api/v1/billing/paydunya/ipn/
```

Sans IPN, la page de retour du front vérifie quand même le paiement auprès de PayDunya.

Expirer à la main les abonnements échus (normalement fait par Celery beat)

```sh
cd apps/api && uv run python manage.py process_expired_subscriptions
```

## Stack complète en local (comme en production)

```sh
docker compose up --build
```

Le site est servi sur http://localhost.

## Déploiement

Un push sur `recette` déploie la recette, un push sur `prod` déploie la production (GitHub Actions → images GHCR → VPS).
Détails et mise en place : [`deploy/README.md`](deploy/README.md).
