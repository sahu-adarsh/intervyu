from fastapi import APIRouter, Depends, HTTPException
from app.models.session import CreateSessionRequest, SessionResponse, EndSessionResponse
from app.services.s3_service import S3Service
from app.dependencies.auth import CurrentUser, get_current_user
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
s3_service = S3Service()

@router.post("", response_model=SessionResponse)
async def create_session(
    request: CreateSessionRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new interview session"""
    try:
        session_id = str(uuid.uuid4())

        session_data = {
            "session_id": session_id,
            "user_id": current_user.user_id,
            "interview_type": request.interview_type,
            "candidate_name": request.candidate_name,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "status": "active",
            "transcript": []
        }

        # Save to S3
        success = s3_service.save_session(session_data)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to create session")

        return SessionResponse(
            session_id=session_id,
            interview_type=request.interview_type,
            candidate_name=request.candidate_name,
            created_at=session_data["created_at"],
            status="active"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get session details"""
    try:
        session_data = s3_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        # Verify session belongs to requesting user
        if session_data.get("user_id") and session_data["user_id"] != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return SessionResponse(
            session_id=session_data["session_id"],
            interview_type=session_data["interview_type"],
            candidate_name=session_data["candidate_name"],
            created_at=session_data["created_at"],
            status=session_data.get("status", "active")
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
