# Audit Technique & Implémentation du Système de Gamification et de Classement des Membres

Ce document regroupe les **8 livrables attendus** suite à l'audit approfondi et à la consolidation complète du système de gamification et de classement multi-tenant par communauté.

---

## Livrable 1 : Rapport d'Audit de l'Existant

### 1.1. Ce qui existait déjà dans le codebase
1. **Modèles (`apps/gamification/models/`)** :
   - [`UserReputation`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/models/reputation.py) : Modèle global `1-to-1` avec `User` stockant `total_points`, `level`, `rank_title`, `current_streak_days`, et `last_activity_date`.
   - [`ReputationTransaction`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/models/reputation.py) : Journal des points (`user`, `community`, `action`, `points`, `description`).
   - [`Badge`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/models/badge.py) & [`UserBadge`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/models/badge.py) : Système de badges de succès.
   - [`CommunityMember.reputation_score`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/memberships/models/member.py) : Champ entier sur l'adhésion d'un membre à une communauté.
2. **Service & Sélecteurs (`apps/gamification/services/`, `apps/gamification/selectors/`)** :
   - [`GamificationService.award_points`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/services/gamification_service.py) : Enregistrait une transaction et mettait à jour `UserReputation`.
   - [`GamificationSelector.get_global_leaderboard`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/selectors/gamification_selector.py) et [`get_community_leaderboard`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/selectors/gamification_selector.py) : Agrégation basique des points.
3. **Endpoints existants (`apps/gamification/urls.py`)** :
   - `GET /api/v1/gamification/reputation/me/`
   - `GET /api/v1/gamification/reputation/history/`
   - `GET /api/v1/gamification/badges/` & `GET /api/v1/gamification/badges/my/`
   - `GET /api/v1/gamification/leaderboard/`
   - `GET /api/v1/communities/<slug:slug>/leaderboard/`

### 1.2. Fonctionnalités manquantes, incohérences et vulnérabilités identifiées
1. **Absence totale des déclencheurs automatiques métier** :
   - **Formations (`apps/classroom`)** : `ProgressService.update_progress` passait `enrollment.completed_at` à `timezone.now()` à 100%, mais **n'appelait jamais `GamificationService`** pour attribuer les 50 points de `course_completed`.
   - **Événements (`apps/events`)** : Aucun point `event_attended` n'était attribué lors de la confirmation de présence (`join-live`, webhook LiveKit `participant_joined` ou fin d'événement).
   - **Publications Feed (`apps/posts`)** : `PostService.create_post` ne déclenchait aucune attribution de points `post_created`.
   - **Désynchronisation de `CommunityMember.reputation_score`** : `PostService.mark_accepted_answer` incrémentait manuellement `CommunityMember.reputation_score` (+15) sans créer de `ReputationTransaction`, tandis que `GamificationService.award_points` ne mettait jamais à jour `CommunityMember.reputation_score`.
2. **Barème par défaut codé en dur et incohérent** :
   - `ACTION_DEFAULT_POINTS` définissait `POST_CREATED = 5` (au lieu de **10 points**) et `EVENT_ATTENDED = 20` (au lieu de **30 points**).
   - **Aucune table de configuration par communauté** (`CommunityPointRule`) ni d'historique des modifications du barème (`CommunityPointRuleAuditLog`).
3. **Absence d'idempotence et de traçabilité complète sur `ReputationTransaction`** :
   - Il manquait `reference_type`, `reference_id`, `source` (`automatic` vs `manual_adjustment`), `awarded_by` et `idempotency_key` (unicité en base) pour empêcher les doubles attributions.
4. **Lacunes du Classement (Leaderboard)** :
   - Pas de gestion cohérente des égalités (`rank` identique en cas d'égalité de points + critère de départage déterministe).
   - Le `level` et le `rank_title` dans le classement d'une communauté utilisaient le niveau global de l'utilisateur au lieu d'être isolés aux points gagnés dans la communauté.
   - Absence de la position du membre connecté (`my_position` / `/leaderboard/me/`), des filtres `Top 3 / Top 10 / Top 100` (`?top=`) et de la pagination complète (`page`, `page_size`).
5. **Absence des API de Configuration, de Statistiques et d'Administration** :
   - Aucune API pour consulter/modifier le barème d'une communauté, consulter l'audit du barème, ajuster manuellement les points d'un membre avec motif obligatoire, ou obtenir les statistiques globales de gamification de la communauté.

---

## Livrable 2 : Modifications Apportées aux Modèles et à la Base de Données

Fichiers modifiés / créés :
- [`apps/api/apps/gamification/models/reputation.py`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/models/reputation.py)
- [`apps/api/apps/gamification/migrations/0002_community_point_rules_and_tx_audit.py`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/migrations/0002_community_point_rules_and_tx_audit.py)

1. **Enrichissement de `ReputationTransaction` (`gamification_reputation_transactions`)** :
   - `reference_type` (`CharField`) : Type d'entité (`"course"`, `"event"`, `"post"`, `"comment"`, `"badge"`, `"manual"`).
   - `reference_id` (`CharField`, indexé) : Identifiant UUID de l'activité concernée.
   - `source` (`CharField`, indexé) : `automatic`, `manual_adjustment`, `badge_reward`, `system`.
   - `awarded_by` (`ForeignKey` vers `User`, nullable) : Administrateur/Propriétaire à l'origine d'un ajustement manuel.
   - `idempotency_key` (`CharField`, `unique=True`, indexé) : Clé composite `{community_id}:{user_id}:{action}:{reference_type}:{reference_id}` garantissant au niveau SGBD qu'une activité ne génère des points qu'une seule fois.
   - Index composites ajoutés : `idx_rep_tx_comm_user_date`, `idx_rep_tx_comm_act_ref`, `idx_rep_tx_comm_date`.
2. **Nouveau modèle `CommunityPointRule` (`gamification_community_point_rules`)** :
   - Stocke le barème propre à chaque communauté (`community`, `action`, `label`, `description`, `points`, `is_active`, `allow_multiple_per_reference`, `updated_by`).
   - Contrainte d'unicité `unique_together = ("community", "action")` et index `idx_comm_pt_rule_lookup`.
3. **Nouveau modèle `CommunityPointRuleAuditLog` (`gamification_point_rule_audit_logs`)** :
   - Journalise de manière immuable chaque modification du barème d'une communauté (`community`, `rule`, `action`, `changed_by`, `previous_points`, `new_points`, `previous_is_active`, `new_is_active`, `note`, `created_at`).

---

## Livrable 3 : Services Métier Développés et Améliorés

- [`GamificationService`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/services/gamification_service.py) :
  - `check_can_manage_gamification(user, community)` : Vérifie strictement que l'acteur est le **Propriétaire (`owner`)**, un **Administrateur autorisé (`admin`)** de la communauté ou un **Superadmin**.
  - `ensure_community_rules(community)` & `get_rule_for_action(community, action)` : Initialise et résout dynamiquement le barème de la communauté (par défaut : **Formation terminée = 50 pts**, **Participation événement = 30 pts**, **Publication post = 10 pts**).
  - `update_community_rule(...)` & `bulk_update_community_rules(...)` : Met à jour les points et/ou l'activation d'une règle, journalise le changement dans `CommunityPointRuleAuditLog`, **sans recalculer rétroactivement** les points déjà acquis.
  - `award_points(...)` : Attribution transactionnelle (`transaction.atomic()` + `select_for_update()`), vérification de la clé d'idempotence (`idempotency_key`), synchronisation automatique de `CommunityMember.reputation_score` et `DeveloperProfile.reputation_points`.
  - `adjust_member_points(actor, community, target_user, points_delta, reason)` : Ajustement manuel positif ou négatif avec motif obligatoire, historisé sans jamais altérer ni supprimer les transactions passées.
- [`GamificationSelector`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/gamification/selectors/gamification_selector.py) :
  - Calcul optimisé du classement par communauté avec isolation multi-tenant stricte, gestion des égalités, filtres `Top 3 / Top 10 / Top 100`, pagination et statistiques globales.

---

## Livrable 4 & 7 : Endpoints API Créés / Modifiés & API du Classement

### A. Consultation des Points & Statistiques
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/communities/<slug>/gamification/points/me/` | Total des points du membre connecté dans la communauté, niveau local, rang et répartition par activité. |
| `GET` | `/api/v1/communities/<slug>/gamification/members/<user_id>/points/` | Total des points, niveau, rang et répartition par activité d'un membre spécifique dans la communauté. |
| `GET` | `/api/v1/communities/<slug>/gamification/points/history/` | Historique des points gagnés/ajustés du membre connecté dans la communauté (`?action=`, `?source=`). |
| `GET` | `/api/v1/gamification/reputation/history/` | Historique global du membre connecté (supporte désormais `?community=<slug>`, `?action=`, `?source=`). |
| `GET` | `/api/v1/communities/<slug>/gamification/stats/` | Statistiques globales de gamification de la communauté (total distribué, membres récompensés, répartition par activité, Top 3). |

### B. Classement des Membres (Leaderboard)
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/communities/<slug>/leaderboard/` *(et `/gamification/leaderboard/`)* | Classement isolé de la communauté par ordre décroissant de points. Supporte `?top=3`, `?top=10`, `?top=100`, `?page=1&page_size=20`, `?period=all_time\|monthly\|weekly`. Retourne aussi la position du membre connecté dans `meta.current_user`. |
| `GET` | `/api/v1/communities/<slug>/leaderboard/me/` *(et `/gamification/leaderboard/me/`)* | Position exacte du membre connecté (`rank`, `position`, `is_tied`, `points`, `points_to_next_rank`) et membres adjacents (`surrounding_entries`). |

### C. Configuration du Barème par Communauté (Propriétaire / Admin)
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/communities/<slug>/gamification/rules/` | Liste toutes les activités récompensables et le barème actif de la communauté. |
| `PATCH` | `/api/v1/communities/<slug>/gamification/rules/` | Modification groupée de plusieurs règles du barème (`{"rules": [...]}`). |
| `PATCH` | `/api/v1/communities/<slug>/gamification/rules/<action>/` | Modifier le nombre de points (`points`) et/ou activer/désactiver (`is_active`) une activité (ex: `course_completed`, `event_attended`, `post_created`). |
| `GET` | `/api/v1/communities/<slug>/gamification/rules/history/` | Journal d'audit des modifications apportées au barème de la communauté. |

### D. Administration & Ajustements Manuels (Propriétaire / Admin)
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/communities/<slug>/gamification/points/adjust/` | Ajouter ou retirer manuellement des points à un membre avec motif obligatoire (`{"user_id": "...", "points": 25, "reason": "..."}`). |
| `GET` | `/api/v1/communities/<slug>/gamification/transactions/` | Journal complet de toutes les attributions automatiques et ajustements manuels de la communauté (`?user_id=`, `?action=`, `?source=`, `?page=`). |

---

## Livrable 5 : Mécanismes d'Attribution Automatique des Points

1. **Formation terminée (`course_completed` — 50 points par défaut)** :
   - Connecté dans [`ProgressService.update_progress`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/classroom/services/progress_service.py#L148-L160).
   - Se déclenche **uniquement** lorsque `total_lessons > 0` et `progress_pct >= 100.0` (toutes les leçons de la formation sont validées). L'inscription (`enroll_user`) ne donne aucun point.
   - Clé d'idempotence liée à `course.id` : une formation terminée ne rapporte des points qu'une seule fois par membre.
2. **Participation effective à un événement (`event_attended` — 30 points par défaut)** :
   - Connecté dans [`EventService.confirm_attendance`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/events/services/event_service.py#L271-L318), appelé automatiquement lors du `join-live` LiveKit ([`EventJoinLiveView`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/events/views/live.py)), du webhook LiveKit `participant_joined`, du check-in (`POST /api/v1/communities/<slug>/events/<event_id>/check-in/`), et à la clôture d'un événement pour les participants ayant un `checked_in_at` confirmé.
   - La simple inscription RSVP (`rsvp_event`) ne donne aucun point.
   - Clé d'idempotence liée à `event.id`.
3. **Publication d'un post dans le feed (`post_created` — 10 points par défaut)** :
   - Connecté dans [`PostService.create_post`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/apps/posts/services/post_service.py#L131-L135) après validation et modération pré-publication.
   - Clé d'idempotence liée à `post.id`.

---

## Livrable 8 : Tests Automatisés

La suite complète de tests a été ajoutée dans [`apps/api/tests/test_gamification_and_leaderboard_api.py`](file:///c:/Users/User/Documents/SINUX/Apps/kodinga-mono-repo/apps/api/tests/test_gamification_and_leaderboard_api.py) et couvre :
- `test_automatic_points_course_event_and_post_plus_idempotence`
- `test_community_rule_configuration_and_non_retroactivity`
- `test_multi_tenant_isolation_between_communities`
- `test_manual_point_adjustments_and_audit_trail`
- `test_leaderboard_ranking_ties_top_n_pagination_and_my_position`
- `test_permissions_and_unauthorized_access_blocked`

