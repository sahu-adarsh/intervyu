import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.models.session import CreateSessionRequest, SessionResponse, EndSessionResponse
from app.dependencies.auth import CurrentUser, get_current_user
from app.services import db_service
from app.limiter import limiter
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

# Map frontend hyphenated IDs → PostgreSQL enum values
_TYPE_MAP = {
    "google-sde":    "google_sde",
    "amazon-sde":    "amazon_sde",
    "microsoft-sde": "microsoft_sde",
    "aws-sa":        "aws_solutions_architect",
    "azure-sa":      "azure_solutions_architect",
    "gcp-sa":        "gcp_solutions_architect",
    "behavioral":    "behavioral",
    "coding-round":  "coding",
    "cv_grilling":   "behavioral",
    "coding_practice": "coding",
}

def _normalize_type(t: str) -> str:
    normalized = _TYPE_MAP.get(t)
    if normalized is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid interview type: {t!r}")
    return normalized

@router.post("", response_model=SessionResponse)
@limiter.limit("10/hour")
async def create_session(
    request: Request,
    body: CreateSessionRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new interview session"""
    try:
        session_id = await db_service.create_session(
            user_id=current_user.user_id,
            interview_type=_normalize_type(body.interview_type),
            candidate_name=body.candidate_name,
        )
        created_at = datetime.now(timezone.utc).isoformat()

        return SessionResponse(
            session_id=session_id,
            interview_type=body.interview_type,
            candidate_name=body.candidate_name,
            created_at=created_at,
            status="active",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("create_session failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get session details"""
    try:
        session_data = await db_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        if session_data.get("user_id") != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return SessionResponse(
            session_id=session_data["session_id"],
            interview_type=session_data["interview_type"],
            candidate_name=session_data.get("candidate_name", ""),
            created_at=session_data["created_at"],
            status=session_data.get("status", "active"),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
