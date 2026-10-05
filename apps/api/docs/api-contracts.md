# KODINGA API CONTRACTS (REST / OPENAPI)

## 1. Conventions Globales

- Préfixe de version : `/api/v1/`
- En-tête d'autorisation : `Authorization: Bearer <access_token>`
- Format des requêtes et réponses : `Content-Type: application/json`
- Gestion des erreurs conforme à une structure normalisée :

```json
{
  "code": "validation_error",
  "message": "Invalid request payload.",
  "details": {
    "email": ["A user with this email already exists."]
  }
}
```

---

## 2. Contrats d'Authentification & Comptes (`/api/v1/auth/` & `/api/v1/users/`)

| Méthode | Endpoint | Description | Code Succès | Permissions |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register/` | Inscription avec email, username, mot de passe | `201 Created` | Public / AllowAny |
| `POST` | `/api/v1/auth/login/` | Connexion (email + password), création session & tokens | `200 OK` | Public / AllowAny |
| `POST` | `/api/v1/auth/token/refresh/` | Renouvellement de l'access token via refresh token | `200 OK` | Public / AllowAny |
| `POST` | `/api/v1/auth/logout/` | Déconnexion de la session courante (révocation token) | `200 OK` | IsAuthenticated |
| `POST` | `/api/v1/auth/logout-all/` | Déconnexion de tous les appareils / sessions | `200 OK` | IsAuthenticated |
| `POST` | `/api/v1/auth/verify-email/` | Validation du compte par token de vérification | `200 OK` | Public / AllowAny |
| `POST` | `/api/v1/auth/resend-verification/` | Renvoi d'un email de vérification avec limitation de débit | `200 OK` | Public / AllowAny |
| `POST` | `/api/v1/auth/password/reset/` | Demande de réinitialisation de mot de passe (email) | `200 OK` | Public / AllowAny |
| `POST` | `/api/v1/auth/password/reset/confirm/` | Validation du reset de mot de passe par token | `200 OK` | Public / AllowAny |
| `POST` | `/api/v1/auth/password/change/` | Modification de mot de passe pour utilisateur authentifié | `200 OK` | IsAuthenticated |
| `GET` | `/api/v1/auth/sessions/` | Liste des sessions actives du compte | `200 OK` | IsAuthenticated |
| `DELETE` | `/api/v1/auth/sessions/{id}/` | Révocation d'une session spécifique | `204 No Content` | IsAuthenticated |
| `GET` | `/api/v1/auth/google/start/` | Initialisation du flux OAuth Google (URL de redirection) | `200 OK` | Public / AllowAny |
| `POST` | `/api/v1/auth/google/callback/` | Échange du code OAuth Google contre des tokens | `200 OK` | Public / AllowAny |
| `GET` | `/api/v1/auth/github/start/` | Initialisation du flux OAuth GitHub (URL de redirection) | `200 OK` | Public / AllowAny |
| `POST` | `/api/v1/auth/github/callback/` | Échange du code OAuth GitHub contre des tokens | `200 OK` | Public / AllowAny |
| `GET` | `/api/v1/users/me/` | Récupération des informations de l'utilisateur connecté | `200 OK` | IsAuthenticated |
| `PATCH` | `/api/v1/users/me/` | Mise à jour des informations de compte (langue, timezone) | `200 OK` | IsAuthenticated |
| `POST` | `/api/v1/users/me/consents/` | Enregistrement des consentements utilisateur | `201 Created` | IsAuthenticated |
