# CAHIER DES TÂCHES FRONTEND (REACT + TYPESCRIPT) — EMOJIS, MULTIMÉDIA (UPLOADTHING + MUX) & ASSISTANT IA

Ce document regroupe **l'ensemble des tâches Frontend (`apps/web`)** à implémenter par le développeur Frontend à partir des fonctionnalités Backend Django désormais en place et testées.

---

## SOMMAIRE DES TÂCHES

1. **TÂCHE 1 (FE-EMOJI)** : Sélecteur d'Emojis Universel (`emoji-picker-react`) sur Messages privés/groupes, Publications, Commentaires et Réponses.
2. **TÂCHE 2 (FE-TYPES)** : Mise à jour des types TypeScript (`CommunityPostItem`, `UnifiedMediaItem`) et des mutations RTK Query (`community.api.ts`).
3. **TÂCHE 3 (FE-IMAGES)** : Upload multi-images (UploadThing), prévisualisation avant publication, suppression et galerie Lightbox dans le Feed.
4. **TÂCHE 4 (FE-VIDEOS)** : Upload de vidéos (Mux Direct Upload / Ingestion), publication non bloquante, écoute WebSocket temps réel et lecteur vidéo HLS dans le Feed.
5. **TÂCHE 5 (FE-DOCUMENTS)** : Upload de documents (UploadThing), validation client, affichage des cartes documents et téléchargement sécurisé.
6. **TÂCHE 6 (FE-MEDIA-DELETE)** : Suppression d'une pièce jointe sur une publication existante (`DELETE /api/v1/posts/<post_id>/media/<media_id>/`).
7. **TÂCHE 7 (FE-AI-ASSISTANT)** : Adaptation de l'interface de l'Assistant IA Platform-Aware (badges d'intention, sources RAG/Communautés et gestion des refus hors-périmètre).

---

## TÂCHE 1 : SÉLECTEUR D'EMOJIS UNIVERSEL (`emoji-picker-react`)

### 1.1. Installation de la dépendance
À exécuter à la racine du monorepo :
```bash
pnpm --filter web add emoji-picker-react
```

### 1.2. Création du composant réutilisable `<EmojiPickerButton />`
- **Fichier à créer** : `apps/web/src/pages/shared/emoji-picker-button.tsx`
- **Spécifications fonctionnelles** :
  - Ouvrir le sélecteur `EmojiPicker` de `emoji-picker-react` dans un `Popover` (ou menu flottant positionné proprement sur desktop et mobile).
  - Activer :
    - Les **9 catégories standards** : Récents (`suggested`), Smileys & émotions (`smileys_people`), Personnes & corps, Animaux & nature (`animals_nature`), Nourriture & boissons (`food_drink`), Voyages & lieux (`travel_places`), Activités (`activities`), Objets (`objects`), Symboles (`symbols`), Drapeaux (`flags`).
    - La **barre de recherche** d'emojis en français/anglais.
    - La **mémorisation des emojis récents** (`localStorage`).
    - Le **sélecteur de tons de peau** (`👋🏻 👋🏼 👋🏽 👋🏾 👋🏿`).
  - **Insertion à la position du curseur** :
    - Créer un utilitaire `insertEmojiAtCursor(inputEl: HTMLTextAreaElement | HTMLInputElement | null, currentValue: string, emoji: string): { nextValue: string; nextCursorPos: number }` utilisant `selectionStart` et `selectionEnd`.
    - Après sélection d'un emoji, repositionner le curseur juste après l'emoji inséré (`requestAnimationFrame(() => el.setSelectionRange(pos, pos))`) sans perdre le focus.
  - **Important** : Ne faire aucun appel API pour charger la liste des emojis. Le Backend stocke et restitue nativement toutes les séquences Unicode UTF-8 (y compris les séquences ZWJ `👨‍👩‍👧‍👦` et modificateurs de peau).

### 1.3. Intégration dans les 5 zones de saisie de l'application
1. **Discussions privées (1-to-1) & Discussions de groupe** :
   - **Fichier** : `apps/web/src/pages/public/messages/components/thread.tsx`
   - Ajouter `<EmojiPickerButton />` dans le formulaire d'envoi de message (à gauche ou à droite du `<textarea id="message-input">`) ainsi que dans le mode édition d'une bulle (`Bubble`).
2. **Création et modification d'une publication dans le Feed** :
   - **Fichier** : `apps/web/src/pages/community-space/posts/modals/post-form-modal.tsx`
   - Ajouter `<EmojiPickerButton />` pour permettre d'insérer des emojis dans le champ `content` (et optionnellement `title`).
3. **Commentaires et Réponses aux commentaires** :
   - **Fichier** : `apps/web/src/pages/public/community/post/comment-form.tsx`
   - Ajouter `<EmojiPickerButton />` dans la barre d'actions en bas du `<textarea>` (utilisé à la fois pour commenter un post et pour répondre à un commentaire existant).

---

## TÂCHE 2 : MISE À JOUR DES TYPES TYPESCRIPT & RTK QUERY (`community.type.ts` & `community.api.ts`)

### 2.1. Structure unifiée `media` retournée par le Backend sur chaque Post
Chaque publication retournée par `GET /api/v1/communities/<slug>/feed/` et `GET /api/v1/posts/<post_id>/` expose désormais un tableau ordonné `media` :

```ts
export type PostMediaType = 'IMAGE' | 'VIDEO' | 'DOCUMENT';
export type PostMediaProvider = 'UPLOADTHING' | 'MUX' | 'LOCAL' | 'S3';
export type PostMediaStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'DELETED';

export interface UnifiedPostMediaItem {
  id: string;
  type: PostMediaType;
  provider: PostMediaProvider;
  url: string | null;
  playback_url: string | null;   // URL HLS (.m3u8) pour les vidéos Mux
  playback_id?: string | null;   // Playback ID Mux
  thumbnail_url: string | null;  // Miniature WebP Mux (vidéo) ou URL image
  poster_url?: string | null;    // Poster HD 1080p Mux
  filename: string;
  mime_type: string;
  size: number;                  // Taille en octets
  duration: number | null;       // Durée en secondes (vidéo)
  width: number | null;
  height: number | null;
  aspect_ratio?: string | null;
  status: PostMediaStatus;
  error_message?: string | null;
  order: number;
}
```

### 2.2. Payload de création / modification de Post & Réactions Emojis
Dans `apps/web/src/utils/api/community/community.type.ts` :
- **Deux modes supportés pour joindre une image, un document ou une vidéo lors de la création d'un Feed (`POST /api/v1/communities/<slug>/feed/` ou `PATCH /api/v1/posts/<post_id>/`)** :
  1. **Mode JSON (avec pré-upload)** :
     ```ts
     media_ids?: string[]; // UUIDs des MediaAsset (images et documents UploadThing)
     video_ids?: string[]; // UUIDs des VideoAsset (vidéos Mux)
     ```
  2. **Mode Multipart direct en 1 seul appel (`multipart/form-data`)** :
     - Vous pouvez envoyer directement les fichiers dans le `FormData` de `POST /api/v1/communities/<slug>/feed/` via les champs `image` / `images`, `document` / `documents` / `file` / `files`, et `video` / `videos`. Le Backend se charge automatiquement de les stocker sur UploadThing, d'ingérer les vidéos dans Mux et de les attacher à la publication.
- **Visualisation et sélection des réactions emojis sur les Posts et Commentaires** :
  - Chaque Post et Commentaire expose désormais `reactions_summary: Record<string, number>` (ex. `{ "like": 4, "fire": 2, "🎉": 1 }`) en plus de `reactions_count` et `user_reactions: string[]`.
  - Les endpoints `POST /api/v1/posts/<post_id>/react/` et `POST /api/v1/comments/<comment_id>/react/` acceptent aussi bien les clés standards (`"like"`, `"fire"`, `"rocket"`, `"heart"`, `"eyes"`, `"thinking"`, `"unicorn"`) que n'importe quel **emoji Unicode direct** issu du sélecteur (`{ "emoji": "🎉" }` ou `{ "reaction_type": "👏" }`).
- Ajouter la mutation RTK Query pour supprimer un média d'un post :
  ```ts
  deletePostMedia: builder.mutation<void, { postId: string; mediaId: string }>({
    query: ({ postId, mediaId }) => ({
      url: `/posts/${postId}/media/${mediaId}/`,
      method: 'DELETE',
    }),
    invalidatesTags: ['CommunityFeed', 'Post'],
  }),
  ```

---

## TÂCHE 3 : UPLOAD D'IMAGES MULTIPLES DANS LES PUBLICATIONS (UPLOADTHING)

### 3.1. Quotas et formats à valider côté React avant upload
- **Formats autorisés** : `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` (`image/jpeg`, `image/png`, `image/webp`, `image/gif`).
- **Taille maximale** : **10 Mo** (`10 * 1024 * 1024` octets) par image.
- **Nombre maximal** : **10 images** par publication (dans la limite globale de **10 pièces jointes maximum par publication** toutes catégories confondues).

### 3.2. Endpoints Backend d'Upload d'Images
- **Option A — Upload multipart direct (1 ou plusieurs fichiers simultanés)** :
  - `POST /api/v1/media/upload/` (`multipart/form-data`)
  - Body `FormData` :
    - `purpose`: `"post_image"`
    - `files`: liste de fichiers (ou `file` pour un fichier unique)
  - Réponse (`201 Created`) :
    - Si plusieurs fichiers (`files`) : `{ data: { items: [...], count: N, asset_ids: ["uuid1", "uuid2"] } }`
    - Si 1 fichier (`file`) : `{ data: { asset_id: "uuid", file_url: "https://utfs.io/f/...", file_key: "...", file_size: 12345, mime_type: "image/png" } }`
- **Option B — Presigned Upload (UploadThing v7)** :
  1. `POST /api/v1/media/upload-url/` avec `{ file_name, file_size, mime_type, purpose: "post_image" }`
  2. `PUT` du fichier vers `upload_url` retourné
  3. `POST /api/v1/media/confirm-upload/` avec `{ file_key, file_url }`

### 3.3. Comportement UI à implémenter
1. **Dans `apps/web/src/pages/community-space/posts/modals/post-form-modal.tsx`** :
   - Remplacer le bouton désactivé *"Joindre une image (SoonBadge)"* par une barre d'outils multimédia :
     - **Bouton Image** (`accept=".jpg,.jpeg,.png,.webp,.gif"`, `multiple`)
   - Afficher les miniatures des images sélectionnées avec :
     - Indicateur de chargement / barre de progression pendant l'upload.
     - Bouton `X` pour retirer une image avant publication (et appeler `DELETE /api/v1/media/assets/<asset_id>/` si elle a déjà été uploadée).
     - Désactivation du bouton *"Publier"* tant qu'un upload d'image est encore en cours.
2. **Dans `apps/web/src/pages/public/community/components/feed-tab.tsx` (`PostCard`) et la page détail du post** :
   - Filtrer `post.media.filter((m) => m.type === 'IMAGE' && m.status === 'READY')`.
   - Afficher une grille adaptative (1 image pleine largeur, 2 images côte à côte, 3 ou 4+ images en grille avec compteur `+N`) avec `loading="lazy"`.
   - Au clic sur une image, ouvrir une **Lightbox** permettant de naviguer entre les images de la publication.

---

## TÂCHE 4 : UPLOAD & LECTURE DE VIDÉOS DANS LES PUBLICATIONS (MUX HLS)

### 4.1. Quotas et formats à valider côté React
- **Formats autorisés** : `.mp4`, `.mov`, `.webm` (`video/mp4`, `video/quicktime`, `video/webm`).
- **Taille maximale** : **100 Mo** (`100 * 1024 * 1024` octets) par vidéo.
- **Nombre maximal** : **3 vidéos** par publication.

### 4.2. Endpoints Backend d'Upload Vidéo Mux
- **Flux A — Direct Upload vers Mux (Recommandé pour les grosses vidéos)** :
  1. Appeler `POST /api/v1/media/videos/upload-url/` :
     ```json
     {
       "title": "demo.mp4",
       "file_name": "demo.mp4",
       "file_size": 26214400,
       "mime_type": "video/mp4",
       "purpose": "post_video"
     }
     ```
  2. Réponse (`201 Created`) :
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
  3. Envoyer le fichier binaire en `PUT` vers `upload_url` (avec suivi de progression `XMLHttpRequest` / `axios` `onUploadProgress`).
  4. Ajouter `video_asset_id` dans `video_ids: ["<video_asset_id>"]` lors de la soumission du post (`POST /api/v1/communities/<slug>/feed/`).
- **Flux B — Upload via UploadThing + Ingestion Mux automatique** :
  - `POST /api/v1/media/videos/` (`multipart/form-data` avec `file` et `purpose="post_video"`), qui retourne directement le `VideoAsset` créé (`id` à passer dans `video_ids`).

### 4.3. Publication non bloquante, WebSocket temps réel & Lecteur HLS
- **Publication non bloquante** : Une fois l'upload du fichier vidéo terminé vers Mux/UploadThing, l'utilisateur peut cliquer sur *"Publier"* immédiatement même si Mux est encore en train d'encoder la vidéo (`status: "PROCESSING"` ou `"PENDING_UPLOAD"`).
- **Mise à jour en temps réel (WebSocket)** :
  - Lorsque le webhook Mux reçoit `video.asset.ready` ou `video.asset.errored`, le Backend diffuse :
    - Sur le canal de la communauté : événement `post.video.updated` avec `{ post_id: "uuid", video: UnifiedPostMediaItem }`
    - Sur le canal de l'utilisateur : événement `video.status.changed`
  - Dans `useRealtimeCommunityFeed` (`apps/web/src/utils/realtime/use-realtime.ts`), écouter `post.video.updated` pour invalider ou mettre à jour le cache RTK Query du Feed automatiquement.
- **Affichage dans `PostCard` (`feed-tab.tsx`)** :
  - Filtrer `post.media.filter((m) => m.type === 'VIDEO')`.
  - Si `status` est `PENDING_UPLOAD`, `UPLOADING` ou `PROCESSING` : afficher un bloc visuel *"Vidéo en cours de traitement HD…"* avec icône animée.
  - Si `status === 'FAILED'` : afficher un message *"Le traitement de cette vidéo a échoué"*.
  - Si `status === 'READY'` et `playback_url` est présent :
    - Afficher le lecteur vidéo compatible HLS (`<video controls preload="metadata" poster={item.thumbnail_url ?? undefined}>` + `hls.js` ou `@mux/mux-player-react`) avec lecture/pause, volume, plein écran et **aucun lancement automatique avec son**.

---

## TÂCHE 5 : UPLOAD & TÉLÉCHARGEMENT DE DOCUMENTS DANS LES PUBLICATIONS (UPLOADTHING)

### 5.1. Quotas et formats à valider côté React
- **Formats autorisés** : `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt`, `.csv`.
- **Taille maximale** : **25 Mo** (`25 * 1024 * 1024` octets) par document.
- **Nombre maximal** : **10 documents** par publication.
- **Sécurité** : Tout fichier exécutable ou script (`.exe`, `.sh`, `.bat`, `.php`, `.js`, `.html`, `.svg`) est bloqué.

### 5.2. Endpoints Backend
- **Upload** : `POST /api/v1/media/upload/` (`multipart/form-data`) avec `purpose: "post_document"` et `file` (ou `files`).
  - Ajouter les `asset_id` retournés dans `media_ids` lors de la création/modification du post.
- **Téléchargement sécurisé avec contrôle de permissions** :
  - `GET /api/v1/media/assets/<asset_id>/download/`
  - Vérifie automatiquement que le membre a accès à la communauté du post et retourne :
    ```json
    {
      "success": true,
      "data": {
        "id": "uuid",
        "file_name": "architecture.pdf",
        "file_url": "https://utfs.io/f/...",
        "mime_type": "application/pdf",
        "file_size": 102400,
        "media_category": "DOCUMENT",
        "content_disposition": "attachment; filename=\"architecture.pdf\""
      }
    }
    ```

### 5.3. Comportement UI à implémenter
1. **Dans `post-form-modal.tsx`** :
   - Ajouter un bouton *"Joindre un document"* (`accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"`, `multiple`).
   - Afficher chaque document joint sous forme de carte compacte (icône du type de fichier, nom du fichier, taille en Ko/Mo, bouton supprimer `X`).
2. **Dans `PostCard` (`feed-tab.tsx`)** :
   - Filtrer `post.media.filter((m) => m.type === 'DOCUMENT' && m.status === 'READY')`.
   - Afficher une carte de téléchargement propre avec :
     - Icône distinctive selon l'extension (`PDF`, `DOCX`, `XLSX`, `PPTX`, `CSV`, `TXT`).
     - Nom du fichier (`item.filename`) et taille formatée (`item.size`).
     - Bouton *"Télécharger"* qui vérifie l'accès via `GET /api/v1/media/assets/${item.id}/download/` puis déclenche le téléchargement de `file_url`.

---

## TÂCHE 6 : SUPPRESSION D'UN MÉDIA SUR UNE PUBLICATION EXISTANTE

- **Endpoint Backend** :
  - `DELETE /api/v1/posts/<post_id>/media/<media_id>/`
- **Comportement UI** :
  - Lorsqu'un auteur modifie sa publication dans `post-form-modal.tsx` (mode édition `post !== null`), afficher les médias déjà attachés (`post.media`).
  - Si l'utilisateur clique sur le bouton supprimer (`Trash2` / `X`) d'un média existant (image, vidéo ou document), appeler `DELETE /api/v1/posts/${post.id}/media/${mediaItem.id}/` pour le détacher et le supprimer sur UploadThing/Mux, puis rafraîchir la publication.

---

## TÂCHE 7 : INTÉGRATION FRONTEND DE L'ASSISTANT IA PLATFORM-AWARE

Suite à la reconfiguration de l'Assistant IA en **Platform-Aware AI Assistant** (`POST /api/v1/ai/assistant/chat/`), la réponse JSON enrichie contient désormais :

```json
{
  "success": true,
  "data": {
    "conversation_id": "uuid",
    "reply": "Réponse générée par l'assistant...",
    "intent": "PUBLIC_COMMUNITY_INFO",
    "is_out_of_scope": false,
    "sources": [
      {
        "source_type": "official_documentation | dynamic_community_db | private_community_authorized",
        "title": "Guide des Communautés Kodinga",
        "category": "communities_guide",
        "version": "1.0.0"
      }
    ],
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

### Comportement UI recommandé dans le widget Assistant IA :
1. Afficher les **sources utilisées** (`data.sources`) sous forme de petits badges discrets sous la réponse de l'assistant (ex. *Documentation officielle*, *Données communauté en direct*).
2. Lorsque `data.is_out_of_scope === true` (`intent === "OUT_OF_SCOPE"`), afficher la réponse de refus poli de l'assistant et proposer 2 ou 3 boutons de suggestions rapides centrés sur la plateforme :
   - *"Quelles sont les communautés publiques disponibles ?"*
   - *"Comment créer et gérer ma propre communauté ?"*
   - *"Comment fonctionnent les formations, événements et hackathons ?"*

