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


---

# 9. LOT 6 — EMOJIS UNICODE & MULTIMÉDIA FEED (IMAGES UPLOADTHING, VIDÉOS MUX, DOCUMENTS)

Le Backend Django expose désormais une architecture multimédia unifiée et sécurisée (UploadThing v7 + Mux HLS + UTF-8/Unicode). Voici la liste exacte des tâches à implémenter côté Frontend React (`apps/web`).

---

## FE-21 : Sélecteur d'Emojis Universel (`emoji-picker-react`)

- **Installation** :
  ```bash
  pnpm --filter web add emoji-picker-react
  ```
- **Composant réutilisable à créer** (`apps/web/src/components/shared/emoji-picker-button.tsx`) :
  - Utiliser `EmojiPicker` de `emoji-picker-react` dans un `Popover` (`@kodinga/ui`).
  - Activer les **9 catégories standards** (Récents, Smileys & émotions, Personnes & corps, Animaux & nature, Nourriture & boissons, Voyages & lieux, Activités, Objets, Symboles, Drapeaux), la barre de recherche, les emojis récents et le sélecteur de tons de peau (`👋🏻 👋🏼 👋🏽 👋🏾 👋🏿`).
  - Insérer l'emoji sélectionné à la position exacte du curseur (`selectionStart` / `selectionEnd`) dans le `<textarea>` ou `<input>` cible, sans fermer brutalement le champ ni perdre le focus.
- **Emplacements où intégrer `<EmojiPickerButton />`** :
  1. **Discussions privées & de groupe** : `apps/web/src/pages/public/messages/components/thread.tsx` (à côté du bouton d'envoi et dans l'édition d'un message).
  2. **Création / Édition de publication dans le Feed** : `apps/web/src/pages/community-space/posts/modals/post-form-modal.tsx` (pour le champ `title` et le champ `content`).
  3. **Commentaires et réponses aux commentaires** : `apps/web/src/pages/public/community/post/comment-form.tsx`.
- **Règle d'architecture** : Ne faire aucun appel API pour récupérer la liste des emojis (tout le catalogue est géré localement par `emoji-picker-react` et transmis en UTF-8 natif dans `content` / `title`).

---

## FE-22 : Upload d'Images multiples dans les Publications (UploadThing)

- **Limites & Formats appliqués par le Backend** :
  - Formats acceptés : `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` (`image/jpeg`, `image/png`, `image/webp`, `image/gif`).
  - Taille maximale : **10 Mo par image**.
  - Nombre maximal : **10 images par publication** (dans la limite globale de **10 pièces jointes max par publication**).
- **Endpoints Backend disponibles** :
  1. **Upload direct multipart (1 ou plusieurs fichiers)** :
     - `POST /api/v1/media/upload/` (`multipart/form-data`)
     - Champs : `files` (liste de fichiers, jusqu'à 10) ou `file` (fichier unique), `purpose: "post_image"`.
     - Réponse (multi-fichiers) :
       ```json
       {
         "success": true,
         "data": {
           "items": [
             {
               "asset_id": "uuid",
               "file_url": "https://utfs.io/f/...",
               "file_key": "...",
               "file_size": 204800,
               "mime_type": "image/png",
               "provider": "uploadthing"
             }
           ],
           "count": 1,
           "asset_ids": ["uuid"]
         }
       }
       ```
  2. **Alternative Presigned Upload (UploadThing direct client)** :
     - `POST /api/v1/media/upload-url/` avec `{ "file_name": "photo.png", "file_size": 204800, "mime_type": "image/png", "purpose": "post_image" }`
     - Puis `POST /api/v1/media/confirm-upload/` avec `{ "file_key": "...", "file_url": "..." }`.
- **Tâches UI (`post-form-modal.tsx` & `feed-tab.tsx`)** :
  - Activer le bouton *"Joindre des médias"* dans `post-form-modal.tsx` (retirer le `SoonBadge`).
  - Afficher une grille de prévisualisation des images sélectionnées avant publication avec :
    - Barre de progression d'upload.
    - Bouton de suppression (`X`) sur chaque miniature avant publication (et appel `DELETE /api/v1/media/assets/<asset_id>/` si déjà uploadée).
  - Envoyer les UUIDs dans `media_ids: ["uuid1", "uuid2"]` lors du `POST /api/v1/communities/<slug>/feed/` ou `PATCH /api/v1/posts/<post_id>/`.
  - Dans `PostCard` (`feed-tab.tsx`) et la page détail du post : afficher une grille responsive d'images (`lazy loading`, `object-fit: cover`) avec ouverture en **Lightbox** au clic.

---

## FE-23 : Upload & Lecture de Vidéos dans les Publications (Mux HLS)

- **Limites & Formats appliqués par le Backend** :
  - Formats acceptés : `.mp4`, `.mov`, `.webm` (`video/mp4`, `video/quicktime`, `video/webm`).
  - Taille maximale : **100 Mo par vidéo**.
  - Nombre maximal : **3 vidéos par publication**.
- **Endpoints Backend disponibles** :
  1. **Flux A — Direct Upload vers Mux (Recommandé)** :
     - `POST /api/v1/media/videos/upload-url/`
     - Payload :
       ```json
       {
         "title": "Démo projet",
         "file_name": "demo.mp4",
         "file_size": 26214400,
         "mime_type": "video/mp4",
         "purpose": "post_video"
       }
       ```
     - Réponse :
       ```json
       {
         "success": true,
         "data": {
           "video_asset_id": "uuid",
           "upload_id": "mux_upload_id",
           "upload_url": "https://storage.googleapis.com/video-storage-...",
           "status": "waiting",
           "normalized_status": "PENDING_UPLOAD"
         }
       }
       ```
     - Le client envoie le binaire vidéo en `PUT` sur `upload_url`, puis joint `video_ids: ["<video_asset_id>"]` lors de la création de la publication.
  2. **Flux B — Upload via UploadThing + Ingestion Mux automatique** :
     - `POST /api/v1/media/videos/` (`multipart/form-data` avec `file` et `purpose="post_video"`).
- **Publication non bloquante & Temps réel** :
  - Le Backend autorise la publication immédiate du post même si la vidéo est en statut `PENDING_UPLOAD` ou `PROCESSING`.
  - Lorsque Mux termine le transcodage, le webhook met à jour la vidéo en `READY` et diffuse l'événement WebSocket :
    - Canal utilisateur : `video.status.changed`
    - Canal communauté : `post.video.updated` avec `{ "post_id": "uuid", "video": { ... } }`
- **Tâches UI (`feed-tab.tsx`)** :
  - Si `mediaItem.status` est `PENDING_UPLOAD`, `UPLOADING` ou `PROCESSING` : afficher une carte d'état *"Vidéo en cours de traitement…"* avec spinner.
  - Si `mediaItem.status === "FAILED"` : afficher un badge d'erreur *"Le traitement de la vidéo a échoué"*.
  - Si `mediaItem.status === "READY"` : afficher le lecteur vidéo HLS (`mediaItem.playback_url`, poster `mediaItem.thumbnail_url`, contrôles lecture/pause, volume, plein écran, **sans lecture automatique avec son**).

---

## FE-24 : Upload & Téléchargement de Documents dans les Publications (UploadThing)

- **Limites & Formats appliqués par le Backend** :
  - Formats acceptés : `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt`, `.csv`.
  - Taille maximale : **25 Mo par document**.
  - Nombre maximal : **10 documents par publication**.
  - Tout fichier exécutable ou script (`.exe`, `.sh`, `.bat`, `.php`, `.js`, `.html`, `.svg`, signature binaire `MZ`/`ELF`) est strictement rejeté en `400 Bad Request`.
- **Endpoints Backend** :
  - Upload : `POST /api/v1/media/upload/` avec `purpose: "post_document"` (ou `POST /api/v1/media/upload-url/` + `confirm-upload/`).
  - Téléchargement sécurisé : `GET /api/v1/media/assets/<asset_id>/download/` (vérifie automatiquement que l'utilisateur a accès à la communauté du post).
- **Tâches UI (`post-form-modal.tsx` & `feed-tab.tsx`)** :
  - Prévisualiser les documents joints avant publication (icône selon l'extension PDF/Word/Excel/CSV, nom du fichier, taille formatée en Ko/Mo, bouton retirer).
  - Dans le Feed (`PostCard`), afficher une carte document téléchargeable pour chaque élément `media` où `type === "DOCUMENT"`.

---

## FE-25 : Structure Unifiée `post.media` & Suppression d'un Média sur un Post

- **Réponse JSON unifiée retournée par `GET /api/v1/communities/<slug>/feed/` et `GET /api/v1/posts/<post_id>/`** :
  Chaque publication contient désormais un tableau `media` ordonné :
  ```json
  "media": [
    {
      "id": "uuid",
      "type": "IMAGE | VIDEO | DOCUMENT",
      "provider": "UPLOADTHING | MUX",
      "url": "https://utfs.io/f/...",
      "playback_url": "https://stream.mux.com/...m3u8",
      "thumbnail_url": "https://image.mux.com/.../thumbnail.webp",
      "filename": "document.pdf",
      "mime_type": "application/pdf",
      "size": 102400,
      "duration": 42.5,
      "width": 1920,
      "height": 1080,
      "status": "PENDING_UPLOAD | UPLOADING | PROCESSING | READY | FAILED",
      "order": 0
    }
  ]
  ```
- **Suppression d'une pièce jointe d'une publication existante** :
  - Endpoint : `DELETE /api/v1/posts/<post_id>/media/<media_id>/`
  - Autorisé pour l'auteur du post, les modérateurs/propriétaires de la communauté et les superadmins.
  - Détache le média du post et le supprime automatiquement sur UploadThing ou Mux.
