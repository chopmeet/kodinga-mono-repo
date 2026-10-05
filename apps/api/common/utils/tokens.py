import hashlib
import secrets


def generate_secure_token(nbytes: int = 32) -> str:
    """
    Generates a cryptographically strong URL-safe random token.
    """
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """
    Computes a SHA-256 hash of a raw token for secure database persistence.
    """
    return hashlib.sha256(token.encode('utf-8')).hexdigest()
