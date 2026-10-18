# Documentation de l'API - Système d'Invitation de Collaborateurs

Ce document détaille l'architecture, les spécifications des endpoints, les règles de sécurité et les formats de requêtes/réponses pour le système d'invitation d'espaces (Workspaces / Communities).

---

## 1. Vue d'ensemble & Architecture de Sécurité

### 🔐 Cryptographie des Tokens
* **Génération** : Le token est généré avec un générateur cryptographique aléatoire fort (`secrets.token_urlsafe(32)`), garantissant au minimum 256 bits d'entropie.
* **Stockage sécurisé** : Le token en clair n'est **jamais** stocké en base de données. Seule son empreinte **SHA-256** (`token_hash`) est persistée dans la table `memberships_invitations`.
* **Canal d'expédition** : Le token en clair n'apparaît que dans l'e-mail envoyé au collaborateur sous forme de lien (`https://{FRONTEND_URL}/invite/{token}`).

### 🛡️ Contrôle d'Accès & Prévention IDOR
* **Validation de l'email** : Lors de l'acceptation (`POST /api/v1/invitations/:token/accept/`), le serveur vérifie obligatoirement que l'adresse e-mail du compte connecté correspond à l'adresse e-mail invitée. En cas de non-concordance, l'accès est refusé avec une erreur `403 Forbidden` masquant l'adresse pour préserver la confidentialité.
* **Atomicité & Idempotence** : L'acceptation s'exécute dans une transaction atomique avec verrouillage de ligne pessimiste (`select_for_update()`), garantissant qu'aucune requête concurrente ne peut valider deux fois le même lien d'invitation.
* **Protection du dernier administrateur** : Un espace ne peut pas se retrouver sans administrateur. Le dernier administrateur actif ne peut ni être rétrogradé en simple membre, ni être exclu, ni quitter l'espace.

### ⏱️ Rate Limiting & Tâche Planifiée
* **Limitation des invitations** : 20 invitations par heure par espace (`WorkspaceInvitationRateThrottle`).
* **Plafond public anti-bruteforce** : 30 requêtes par minute par IP sur la consultation publique de token (`PublicInvitationRateThrottle`).
* **Nettoyage automatique** : Une tâche Celery Beat quotidienne (`expire_outdated_invitations_task`) fait expirer automatiquement toutes les invitations en attente dont la date limite (`expires_at`) est dépassée.

---

## 2. Spécification des Endpoints

### A. Inviter un collaborateur
* **Méthode / URL** : `POST /api/v1/workspaces/{workspace_id}/invitations/`
* **Droits** : Administrateur ou Propriétaire de l'espace (ou superadmin plateforme).
* **Headers** : `Authorization: Bearer <token_jwt>`

#### Requête :
```json
{
  "email": "collaborateur@exemple.com",
  "role": "editor",
  "expires_in_days": 7
}
```
*Rôles acceptés : `admin`, `editor` (modérateur), `viewer` (membre standard).*

#### Réponse de succès (`201 Created`) :
```json
{
  "success": true,
  "message": "Invitation envoyée avec succès à collaborateur@exemple.com.",
  "data": {
    "id": "e4b2d56a-5431-482a-bc96-12a8a5e30571",
    "email": "collaborateur@exemple.com",
    "role": "moderator",
    "status": "pending",
    "expires_at": "2026-10-25T14:30:00Z",
    "accepted_at": null,
    "invited_by": {
      "id": "93b21890-e22e-4bca-8176-79ef11545621",
      "username": "admin_user",
      "email": "admin@kodinga.com"
    },
    "is_valid": true,
    "created_at": "2026-10-18T14:30:00Z"
  }
}
```

#### Erreurs possibles :
* `403 Forbidden` : Droits administrateur requis.
* `409 Conflict` (`already_member`) : L'utilisateur fait déjà partie de l'espace.
* `409 Conflict` (`invitation_already_pending`) : Une invitation en attente existe déjà pour cette adresse dans cet espace.
* `429 Too Many Requests` : Quota de 20 invitations par heure dépassé pour cet espace.

---

### B. Lister les invitations de l'espace
* **Méthode / URL** : `GET /api/v1/workspaces/{workspace_id}/invitations/?status=pending&page=1`
* **Droits** : Administrateur uniquement.
* **Headers** : `Authorization: Bearer <token_jwt>`

#### Réponse de succès (`200 OK`) :
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "e4b2d56a-5431-482a-bc96-12a8a5e30571",
      "email": "collaborateur@exemple.com",
      "role": "moderator",
      "status": "pending",
      "expires_at": "2026-10-25T14:30:00Z",
      "accepted_at": null,
      "invited_by": {
        "id": "93b21890-e22e-4bca-8176-79ef11545621",
        "username": "admin_user"
      },
      "is_valid": true,
      "created_at": "2026-10-18T14:30:00Z"
    }
  ]
}
```

---

### C. Renvoyer une invitation
* **Méthode / URL** : `POST /api/v1/workspaces/{workspace_id}/invitations/{invitation_id}/resend/`
* **Droits** : Administrateur uniquement.
* **Comportement** : Régénère un nouveau token cryptographique, remet la validité à +7 jours, renvoie l'e-mail et invalide l'ancien token.

#### Réponse de succès (`200 OK`) :
```json
{
  "success": true,
  "message": "Invitation renvoyée avec succès.",
  "data": {
    "id": "e4b2d56a-5431-482a-bc96-12a8a5e30571",
    "email": "collaborateur@exemple.com",
    "status": "pending",
    "expires_at": "2026-10-25T15:00:00Z",
    "is_valid": true
  }
}
```

---

### D. Révoquer une invitation
* **Méthode / URL** : `DELETE /api/v1/workspaces/{workspace_id}/invitations/{invitation_id}/`
* **Droits** : Administrateur uniquement.
* **Comportement** : L'invitation passe en statut `revoked`. Le lien devient immédiatement inutilisable.

#### Réponse de succès (`200 OK`) :
```json
{
  "success": true,
  "message": "Invitation révoquée avec succès."
}
```

---

### E. Consultation publique d'un token (Sans être connecté)
* **Méthode / URL** : `GET /api/v1/invitations/{token}/`
* **Droits** : Public (non authentifié).
* **Usage** : Utilisé par la page frontend `/invite/:token` pour afficher les détails essentiels avant connexion ou inscription.

#### Réponse de succès (`200 OK`) :
```json
{
  "success": true,
  "data": {
    "workspace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "workspace_name": "DevOps Africa Hub",
    "workspace_slug": "devops-africa",
    "workspace_avatar_url": "https://img.kodinga.com/spaces/avatar.png",
    "role": "moderator",
    "role_display": "Éditeur / Modérateur",
    "masked_email": "c***r@exemple.com",
    "status": "pending",
    "expires_at": "2026-10-25T14:30:00Z",
    "is_valid": true
  }
}
```

---

### F. Accepter une invitation
* **Méthode / URL** : `POST /api/v1/invitations/{token}/accept/`
* **Droits** : Utilisateur authentifié.
* **Headers** : `Authorization: Bearer <token_jwt>`

#### Réponse de succès (`200 OK`) :
```json
{
  "success": true,
  "message": "Félicitations ! Vous avez rejoint l'espace DevOps Africa Hub avec succès.",
  "data": {
    "id": "f5e4d3c2-b1a0-9876-fedc-ba9876543210",
    "community": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "role": "moderator",
    "status": "active",
    "joined_at": "2026-10-18T14:45:00Z"
  }
}
```

#### Erreurs possibles :
* `400 Bad Request` (`invitation_expired`) : Le lien a expiré.
* `400 Bad Request` (`invitation_revoked`) : L'invitation a été révoquée par un administrateur.
* `403 Forbidden` : L'e-mail du compte connecté ne correspond pas à l'adresse e-mail invitée.
* `409 Conflict` (`invitation_already_accepted`) : Cette invitation a déjà été acceptée.

---

### G. Gestion des membres de l'espace

#### 1. Lister les membres :
* `GET /api/v1/workspaces/{workspace_id}/members/?search=alice` (Paginé).

#### 2. Modifier le rôle d'un membre :
* `PATCH /api/v1/workspaces/{workspace_id}/members/{user_id}/` (Admin uniquement).
```json
{
  "role": "admin"
}
```
*Note : Si l'utilisateur ciblé est le dernier administrateur actif, sa rétrogradation renvoie `422 Unprocessable Entity`.*

#### 3. Retirer un membre ou quitter l'espace :
* `DELETE /api/v1/workspaces/{workspace_id}/members/{user_id}/`
* Un administrateur peut exclure un membre. Un membre peut se retirer lui-même.
* *Note : Le dernier administrateur ne peut ni être retiré ni quitter l'espace (renvoie `422 Unprocessable Entity`).*

---

## 3. Flux d'inscription avec invitation

Lorsque l'invité n'a pas encore de compte sur la plateforme :
1. La page `/invite/{token}` appelle `GET /api/v1/invitations/{token}/`.
2. L'interface affiche le nom de l'espace, le rôle proposé, et invite l'utilisateur à créer un compte.
3. Le formulaire d'inscription appelle `POST /api/v1/auth/register/` avec le payload suivant :
   ```json
   {
     "email": "collaborateur@exemple.com",
     "username": "collaborateur",
     "password": "Password123!",
     "invitation_token": "{token}"
   }
   ```
4. L'API enregistre l'utilisateur et renvoie dans la réponse `redirect_url: "/invite/{token}"`.
5. Une fois connecté, le frontend finalise automatiquement l'acceptation via `POST /api/v1/invitations/{token}/accept/`.
