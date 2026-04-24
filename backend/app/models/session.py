from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class CreateSessionRequest(BaseModel):
    interview_type: str = Field(..., max_length=100)
    candidate_name: str = Field(..., min_length=1, max_length=200)

class SessionResponse(BaseModel):
    session_id: str
    interview_type: str
    candidate_name: str
    created_at: str
    status: str = "active"

class TranscriptMessage(BaseModel):
    role: str
    content: str
    timestamp: str

class TranscriptResponse(BaseModel):
    session_id: str
    transcript: List[TranscriptMessage]

class EndSessionRequest(BaseModel):
    session_id: str

class EndSessionResponse(BaseModel):
    session_id: str
    status: str
    report_url: Optional[str] = None
