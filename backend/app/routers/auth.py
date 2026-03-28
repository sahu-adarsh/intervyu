from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Return the authenticated user's identity.

    Useful for the frontend to confirm the JWT is accepted by the backend
    and to retrieve the canonical user_id for subsequent requests.
    """
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "role": current_user.role,
    }
