# Kodinga

## Le projet

Plateforme de communautés tech pour l'Afrique (francophone d'abord). Des créateurs ouvrent des
communautés thématiques (IA & Data, Cloud & DevOps, Web & Mobile, Web3 & Fintech…), gratuites ou
payantes ; les membres y publient, discutent et suivent des contenus. Les paiements passent par
PayDunya (Mobile Money : Orange Money, Wave, MTN MoMo, Moov Money, et carte), en XOF / FCFA, et
Kodinga prélève une commission.


## ⛔ RÈGLE ABSOLUE : AUCUNE MIGRATION PAR UN AGENT

Claude Code, Codex, ou tout autre assistant ou générateur de code ne doit **JAMAIS, en aucun cas**, faire les migrations de base de données lui-même. Cette règle ne souffre aucune exception, même si un test, une commande ou une demande semble l'exiger.

Il est interdit de :
- lancer `makemigrations`, `migrate`, `squashmigrations` ou `sqlmigrate` (ni via `manage.py`, ni via `uv run`, `nx`, `docker compose exec` ou un script) ;
- créer, modifier, renommer ou supprimer un fichier dans un dossier `migrations/` ;
- appliquer, annuler ou « faker » une migration sur une base, qu'elle soit locale, de recette ou de production.

Quand une modification de modèle Django demande une migration :
1. modifier le modèle ;
2. **s'arrêter** ;
3. signaler clairement au développeur qu'une migration est nécessaire, et pourquoi.

C'est le développeur qui génère, relit et applique la migration lui-même.


## Monorepo Nx

```
apps/web    Front React (SPA)
apps/api    Back Django (API REST)
libs/ui     Kit UI partagé, importé via @kodinga-mono-repo/ui
deploy/     docker-compose.yaml du VPS + README de déploiement
.github/workflows  recette.yml (branche recette), prod.yml (branche prod), deploy.yml (réutilisable)
```

## Stack

**Front (`apps/web`, `libs/ui`)**
- React 19, TypeScript 5.9, Vite 8
- Tailwind CSS v4 (tokens dans `libs/ui/src/index.css`, couleur primaire `#1D4ED8`, utilitaire `brand`)
- Composants shadcn/Radix + composants repris de moovi-app, dans `libs/ui/src/components`
- React Router 6 (routes dans `apps/web/src/routes/router.tsx`)
- Redux Toolkit + RTK Query (`src/redux`, APIs dans `src/utils/api/<domaine>/`)
- react-hook-form + zod, i18next (FR/EN, `src/locales`), recharts 3, TanStack Table, sonner (toasts), lucide-react
- Tests : Vitest 4 + jsdom + Testing Library

**Back (`apps/api`)**
- Django + Django REST Framework, SimpleJWT, drf-spectacular (schéma OpenAPI)
- PostgreSQL (psycopg 3), Redis, Celery (worker + beat)
- uv pour les dépendances, ruff pour le lint, pytest pour les tests
- Apps : `accounts`, `profiles`, `communities`, `memberships`, `posts`, `billing`, `media`
- Réponses enveloppées : `{ success, data, message }` ou `{ success: false, code, message, details }`

**Infra** : images Docker sur GHCR, déployées sur un VPS par SSH (docker compose + nginx). Recette et prod sont des branches dédiées.

## Commandes

```bash
npx nx run-many -t lint test build --projects=web,ui   # vérif complète du front
npx nx serve web                                        # front en dev
docker compose -p kodinga up -d kodingadb               # PostgreSQL local (docker-compose.yaml racine, 127.0.0.1:5432)
npx nx serve api                                        # api (uv run python manage.py runserver 8000)
npx nx test api                                         # uv run pytest tests/
npx nx lint api                                         # ruff
```

## Conventions front

- Alias `@/` = `apps/web/src`. Le kit UI s'importe depuis `@kodinga-mono-repo/ui`.
- Structure d'une page : `form/UseXxx.ts` (état + logique), `tables/`, `tabs/` (sous-routes avec `NavTabs` + `Outlet` context), `modals/`, `components/`.
- Éléments partagés entre admin et espace communauté : `src/pages/shared/` (libellés, chips de filtre, menu d'actions, thème des graphiques, `FormActions`, `SettingSwitch`).
- Tant que les endpoints n'existent pas, les écrans utilisent des données fictives déterministes dans `src/data/*.data.ts`, typées comme l'API (`src/utils/api/**/**.type.ts`). Les écrans d'auth appellent déjà la vraie API.
- Textes de l'interface en français. Les erreurs de validation de l'API arrivent en anglais et sont traduites dans `src/utils/api/errors.ts`.
- Graphiques : sans animation (`isAnimationActive={false}`), palette et tooltip de `pages/shared/chart-theme.tsx`.
- Tests : `renderAppAt(url)` de `src/test-utils.tsx` monte l'arbre de routes réel (store + toaster). Ouvrir les menus Radix au clavier (Enter) plutôt qu'au clic.
