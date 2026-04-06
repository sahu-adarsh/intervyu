import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from app.limiter import limiter
from app.models.session import TranscriptResponse, TranscriptMessage, EndSessionResponse
from app.services.s3_service import S3Service
from app.services.lambda_service import LambdaService
from app.services.textract_service import TextractService, IndustrySkillExtractor
from app.dependencies.auth import CurrentUser, get_current_user
from app.services import db_service
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])
s3_service = S3Service()
lambda_service = LambdaService()
textract_service = TextractService()


async def _verify_session_owner(session_id: str, user_id: str) -> dict:
    """Fetch session from DB and verify ownership. Raises 404/403 on failure."""
    session_data = await db_service.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return session_data


@router.get("/{session_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get full interview transcript"""
    try:
        await _verify_session_owner(session_id, current_user.user_id)

        messages = await db_service.get_transcript(session_id)
        transcript_messages = [
            TranscriptMessage(
                role=m["role"],
                content=m["content"],
                timestamp=m["timestamp"],
            )
            for m in messages
        ]

        return TranscriptResponse(session_id=session_id, transcript=transcript_messages)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _generate_report_background(
    session_id: str,
    user_id: str,
    session_data: dict,
    ended_at: datetime,
) -> None:
    """Generate performance report in background and update session status when done."""
    try:
        transcript_messages = await db_service.get_transcript(session_id)
        duration = 0
        if session_data.get("created_at"):
            try:
                started_at = datetime.fromisoformat(session_data["created_at"])
                duration = int((ended_at - started_at.replace(tzinfo=timezone.utc)).total_seconds())
            except Exception:
                pass

        loop = asyncio.get_event_loop()
        report = await loop.run_in_executor(
            None,
            lambda: lambda_service.invoke_performance_evaluator(
                session_id=session_id,
                conversation_history=transcript_messages,
                code_submissions=[],
                interview_type=session_data.get("interview_type", "Technical Interview"),
                duration=duration,
                candidate_name=session_data.get("candidate_name", "Candidate"),
                save_to_s3=True,
            ),
        )

        await db_service.save_performance_report(
            session_id=session_id,
            user_id=user_id,
            report=report,
        )
        await db_service.update_session_status(session_id, "completed", ended_at)

    except Exception as e:
        logger.error(f"Background report generation failed for {session_id}: {e}")
        await db_service.update_session_status(session_id, "completed", ended_at)


@router.post("/{session_id}/end", response_model=EndSessionResponse)
async def end_interview(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """End interview session and kick off background report generation."""
    try:
        session_data = await _verify_session_owner(session_id, current_user.user_id)
        ended_at = datetime.now(timezone.utc)

        # Fire and forget — Lambda call runs in a thread, doesn't block the response
        # Session stays "active" while generating; background task sets it to "completed" when done
        asyncio.create_task(
            _generate_report_background(session_id, current_user.user_id, session_data, ended_at)
        )

        return EndSessionResponse(
            session_id=session_id,
            status="active",
            report_url=None,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/upload-cv")
@limiter.limit("5/hour")
async def upload_cv(
    request: Request,
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    file: UploadFile = File(...),
):
    """Upload and analyze candidate CV with PDF/DOCX support"""
    try:
        session_data = await _verify_session_owner(session_id, current_user.user_id)

        content = await file.read()
        file_extension = file.filename.lower().split('.')[-1]

        cv_text = ""
        if file_extension == 'pdf':
            cv_text = textract_service.extract_text_from_pdf(content)
        elif file_extension in ['doc', 'docx']:
            cv_text = textract_service.extract_text_from_pdf(content)
        elif file_extension == 'txt':
            try:
                cv_text = content.decode('utf-8')
            except Exception:
                raise HTTPException(status_code=400, detail="Unable to decode text file")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_extension}. Supported: PDF, DOCX, TXT",
            )

        if not cv_text.strip():
            raise HTTPException(status_code=400, detail="No text extracted from file")

        # Upload binary to S3
        s3_key = s3_service.upload_cv(session_id, content, file.filename)

        # Save document record to DB
        await db_service.save_cv_document(
            session_id=session_id,
            filename=file.filename,
            s3_key=s3_key or f"cvs/{session_id}/{file.filename}",
            file_size_bytes=len(content),
            mime_type=file.content_type,
        )

        # Analyze CV using Lambda (returns parsed data + corrections from two Claude calls)
        analysis = lambda_service.invoke_cv_analyzer(cv_text=cv_text)

        # Separate corrections from the main analysis before storing
        corrections = analysis.pop('corrections', {})

        # Extract industry-specific skills
        interview_type = session_data.get("interview_type", "")
        industry = "software_engineering"
        if "solutions architect" in interview_type.lower() or "aws" in interview_type.lower():
            industry = "cloud_architect"
        elif "data" in interview_type.lower():
            industry = "data_science"

        categorized_skills = IndustrySkillExtractor.extract_skills_by_industry(cv_text, industry)
        analysis['categorized_skills'] = categorized_skills
        analysis['industry'] = industry
        analysis['file_type'] = file_extension

        # Save analysis to DB — corrections stored in structured_data JSONB column
        await db_service.save_cv_analysis(
            session_id=session_id,
            skills_json=analysis,
            raw_text=cv_text[:10000],
            structured_data=corrections,
        )

        return JSONResponse(content={
            "success": True,
            "analysis": analysis,
            "corrections": corrections,
            "message": f"CV uploaded and analyzed successfully ({file_extension.upper()})",
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/cv-analysis")
async def get_cv_analysis(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get CV analysis for a session"""
    try:
        await _verify_session_owner(session_id, current_user.user_id)

        cv_data = await db_service.get_cv_analysis(session_id)

        return JSONResponse(content={
            "success": True,
            "analysis": cv_data.get("skills", {}) if cv_data else {},
            "corrections": cv_data.get("structured_data", {}) if cv_data else {},
            "filename": cv_data.get("filename", "") if cv_data else "",
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/cv-url")
async def get_cv_presigned_url(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return a short-lived pre-signed S3 URL for the uploaded CV file."""
    try:
        await _verify_session_owner(session_id, current_user.user_id)

        pool = await db_service.get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT s3_key, filename, mime_type FROM cv_documents WHERE session_id = $1::uuid ORDER BY created_at DESC LIMIT 1",
                session_id,
            )

        if not row:
            raise HTTPException(status_code=404, detail="No CV found for this session")

        s3_key = row["s3_key"]
        # Strip s3://bucket-name/ prefix if present
        if s3_key.startswith("s3://"):
            s3_key = "/".join(s3_key.split("/")[3:])

        url = s3_service.s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': s3_service.bucket_name, 'Key': s3_key},
            ExpiresIn=3600,
        )
        return JSONResponse(content={"url": url, "filename": row["filename"]})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV presigned URL error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/performance-report")
async def get_performance_report(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get performance report for a completed interview"""
    try:
        session_data = await _verify_session_owner(session_id, current_user.user_id)

        status = session_data.get("status")
        if status != "completed":
            return JSONResponse(status_code=202, content={"status": "processing"})

        report = await db_service.get_performance_report(session_id)

        if not report:
            # Completed but report missing — treat as still processing
            return JSONResponse(status_code=202, content={"status": "processing"})

        return JSONResponse(content={
            "success": True,
            "report": report,
            "report_url": report.get("report_s3_key", ""),
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
