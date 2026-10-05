# KODINGA SECURITY SPECIFICATION & HARDENING

## 1. Sécurité de l'Authentification & Sessions

1. **Hachage Sécurisé des Mots de Passe :**
   - Algorithme par défaut : PBKDF2 avec SHA-256 (Django standard) / Argon2.
   - Validation stricte de la complexité des mots de passe (longueur minimale de 8 caractères, pas de séquences communes).

2. **Cycle de Vie des Tokens & JWT :**
   - **Access Token** : Durée de vie courte (15 minutes).
   - **Refresh Token** : Durée de vie configurable (7 jours) avec rotation automatique à chaque rafraîchissement (`ROTATE_REFRESH_TOKENS = True`).
   - **Blacklist & Révocation** : Chaque refresh token possède un `jti` unique indexé dans la table des sessions. Lors d'une déconnexion ou révocation, le token est immédiatement révoqué et blacklisté.
   - **Protection contre le rejeu de token révoqué** : La réutilisation d'un refresh token déjà révoqué invalide immédiatement toute la chaîne de session associée.

3. **Protection des Tokens à Usage Unique (`AuthToken`) :**
   - Les tokens sensibles (vérification email, reset password) ne sont **jamais** stockés en clair dans la base de données.
   - Seul le condensat SHA-256 du token (`token_hash`) est persisté avec une date d'expiration stricte et un flag `consumed_at`.

4. **Prévention de l'Énumération des Comptes :**
   - Les endpoints de demande de réinitialisation de mot de passe et de renvoi d'email renvoient toujours une réponse générique identique (`200 OK`), que l'email existe ou non en base.

5. **Limitation de Débit (Throttling) :**
   - Rate-limiting appliqué sur les endpoints sensibles (`login`, `register`, `password/reset`, `resend-verification`) via les throttles DRF et Redis.

---

## 2. Multi-Tenancy & Contrôle d'Accès

1. **Prévention des Attaques IDOR (Insecure Direct Object References) :**
   - L'accès à toute ressource est vérifié au niveau de l'objet (`has_object_permission`).
   - L'appartenance à la communauté courante (`community_id`) et le niveau de privilège (Owner, Admin, Moderator, Member) sont vérifiés systématiquement par les services et permissions.

2. **Politique CORS & Headers de Sécurité :**
   - `django-cors-headers` configuré avec une liste blanche stricte des origines frontend autorisées.
   - Headers de protection : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

3. **Validation et Nettoyage des Données :**
   - Tous les inputs utilisateur transitent par les serializers DRF avec des validateurs stricts.
   - Échappement automatique dans les templates d'email pour neutraliser toute tentative d'injection HTML ou de Template Injection.
