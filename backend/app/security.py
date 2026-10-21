"""Password hashing (stdlib scrypt) and session token helpers."""

import hashlib
import hmac
import os
import secrets

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16


def _scrypt(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P
    )


def hash_password(password: str) -> str:
    """Return a self-describing hash: ``scrypt$<salt hex>$<hash hex>``."""
    salt = os.urandom(_SALT_BYTES)
    return f"scrypt${salt.hex()}${_scrypt(password, salt).hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, hash_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = bytes.fromhex(salt_hex), bytes.fromhex(hash_hex)
    except ValueError:
        return False
    return hmac.compare_digest(_scrypt(password, salt), expected)


# Verified against when the email is unknown, so sign-in takes the same time
# whether or not the account exists.
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """Only this digest is stored, so a leaked database does not leak sessions."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
