# Déploiement

Un push sur `recette` déploie la recette, un push sur `prod` déploie la production.
`.github/workflows/recette.yml` et `prod.yml` lancent les vérifications (lint, test, build), puis
appellent `deploy.yml`, qui :

1. construit les images `api` et `web` et les publie sur GHCR :
   `ghcr.io/<owner>/<repo>/{api,web}:<env>-<sha7>` (tag fixe) et `:<env>` (dernière version de l'environnement) ;
2. copie `deploy/docker-compose.yaml` sur le VPS et lance `docker compose pull && up -d` ;
3. vérifie `/api/v1/health/` à travers le conteneur web, et fait échouer le job si l'API ne répond pas.

Sur une pull request, les images sont seulement construites (rien n'est publié ni déployé).

## La stack sur le VPS (`deploy/docker-compose.yaml`)

| Service | Rôle |
|---|---|
| `web` | nginx : sert le build React et relaie `/api`, `/admin`, `/static` vers `api`. Seul port publié, sur `127.0.0.1:${WEB_PORT}` |
| `api` | Django + Gunicorn, applique les migrations au démarrage |
| `celery_worker`, `celery_beat` | emails asynchrones et tâches planifiées (même image que `api`) |
| `redis` | broker Celery + cache Django |
| `postgres` | uniquement avec `COMPOSE_PROFILES=local-db` (inutile si `DATABASE_URL` pointe vers Neon) |

La recette et la production peuvent tourner sur le même VPS : chacune est un projet compose distinct
(`kodinga-recette`, `kodinga-production`), avec son dossier, son port et ses volumes.

## Mise en place (une seule fois)

### 1. Sur le VPS (une fois par environnement)

```bash
sudo mkdir -p /opt/kodinga/recette && sudo chown "$USER" /opt/kodinga/recette
# copier deploy/api.env.example dans ce dossier sous le nom api.env et le remplir (les secrets restent sur le VPS)
nano /opt/kodinga/recette/api.env
```

Docker et son plugin compose doivent être installés, et l'utilisateur SSH doit pouvoir lancer `docker`.

Ensuite, faire pointer le domaine vers le port publié avec le reverse proxy déjà présent sur le VPS
(nginx, Caddy, Traefik…), qui gère aussi le HTTPS. Exemple avec Caddy :

```
recette.kodinga.com {
    reverse_proxy 127.0.0.1:8082
}
```

### 2. Sur GitHub : Settings → Environments → `recette` et `production`

| Type | Nom | Exemple |
|---|---|---|
| secret | `VPS_HOST` | `203.0.113.10` |
| secret | `VPS_USER` | `deploy` |
| secret | `VPS_SSH_PRIVATE_KEY` | clé privée dont la clé publique est dans le `~/.ssh/authorized_keys` du VPS |
| secret | `SSH_PASSPHRASE` | seulement si la clé en a une |
| secret | `GHCR_TOKEN` | token d'accès personnel avec `read:packages` (permet au VPS de récupérer les images) |
| variable | `DEPLOY_PATH` | `/opt/kodinga/recette` |
| variable | `WEB_PORT` | `8082` (recette), `8081` (production) |
| variable | `COMPOSE_PROFILES` | vide, ou `local-db` |

Variables du dépôt (Settings → Secrets and variables → Actions → Variables) :
`RECETTE_SITE_URL` (`https://recette.kodinga.com`) et `PROD_SITE_URL` (`https://kodinga.com`).

Publier les images ne demande aucun secret : le workflow utilise son propre `GITHUB_TOKEN`.
Conseil : ajouter des *required reviewers* sur l'environnement `production` pour valider chaque mise en prod.

## Revenir à une version précédente

Sur le VPS, indiquer un ancien tag fixe puis redémarrer :

```bash
cd /opt/kodinga/production
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=production-abc1234/' .env
docker compose -p kodinga-production up -d
```

Les images des 7 derniers jours restent sur le VPS (les plus anciennes, inutilisées, sont supprimées à
chaque déploiement). Pour un tag plus ancien, lancer d'abord `docker login ghcr.io` pour que compose
puisse le récupérer.

Le prochain déploiement depuis GitHub réécrit le `.env`.
