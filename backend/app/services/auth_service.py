import hashlib
import time
import logging
from typing import Optional

import jwt

from app.config.settings import SUPABASE_JWT_SECRET

logger = logging.getLogger(__name__)

# Short-lived in-memory token cache: {token_hash: (payload, expires_at)}
# Avoids repeated JWT decode/verify on every request within the same minute.
_token_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL_SECONDS = 60


def _cache_key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _get_cached(token: str) -> Optional[dict]:
    key = _cache_key(token)
    entry = _token_cache.get(key)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    if key in _token_cache:
        del _token_cache[key]
    return None


def _set_cached(token: str, payload: dict) -> None:
    key = _cache_key(token)
    _token_cache[key] = (payload, time.monotonic() + _CACHE_TTL_SECONDS)


def verify_supabase_jwt(token: str) -> dict:
    """Verify a Supabase-issued JWT and return the decoded payload.

    Returns dict with at minimum:
        sub  — user UUID (auth.users.id)
        email — user email
        role  — 'authenticated'
        exp  — expiry unix timestamp

    Raises ValueError on invalid / expired token.
    """
    cached = _get_cached(token)
    if cached:
        return cached

    if not SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET is not configured")

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_exp": True},
        )
    except jwt.ExpiredSignatureError:
        logger.warning("JWT verify failed: token expired")
        raise ValueError("Token has expired")
    except jwt.InvalidAudienceError as exc:
        logger.warning("JWT verify failed: invalid audience — %s", exc)
        raise ValueError("Invalid token audience")
    except jwt.InvalidTokenError as exc:
        logger.warning("JWT verify failed: %s", exc)
        raise ValueError(f"Invalid token: {exc}")

    _set_cached(token, payload)
    return payload
