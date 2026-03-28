from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services.auth_service import verify_supabase_jwt

_bearer = HTTPBearer(auto_error=True)


@dataclass
class CurrentUser:
    user_id: str   # UUID string — auth.users.id
    email: str
    role: str      # Supabase role claim ('authenticated')


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    """FastAPI dependency — validates Supabase JWT, returns CurrentUser.

    Usage:
        @router.get("/example")
        async def handler(current_user: CurrentUser = Depends(get_current_user)):
            ...
    """
    try:
        payload = verify_supabase_jwt(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(
        user_id=payload["sub"],
        email=payload.get("email", ""),
        role=payload.get("role", "authenticated"),
    )
