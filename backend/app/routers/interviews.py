import logging
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from app.models.session import TranscriptResponse, TranscriptMessage, EndSessionResponse
from app.services.s3_service import S3Service
from app.services.lambda_service import LambdaService
from app.services.textract_service import TextractService, IndustrySkillExtractor
from datetime import datetime
from typing import Optional
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])
s3_service = S3Service()
lambda_service = LambdaService()
textract_service = TextractService()

@router.get("/{session_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(session_id: str):
    """Get full interview transcript"""
    try:
        session_data = s3_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        transcript_messages = [
            TranscriptMessage(
                role=msg.get("role", ""),
                content=msg.get("content", ""),
                timestamp=msg.get("timestamp", "")
            )
            for msg in session_data.get("transcript", [])
        ]

        return TranscriptResponse(
            session_id=session_id,
            transcript=transcript_messages
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/end", response_model=EndSessionResponse)
async def end_interview(session_id: str):
    """End interview session and generate performance report"""
    try:
        session_data = s3_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        # Update session status
        session_data["status"] = "completed"
        session_data["ended_at"] = datetime.utcnow().isoformat()

        # Calculate interview duration
        started_at = datetime.fromisoformat(session_data.get("created_at", datetime.utcnow().isoformat()))
        ended_at = datetime.utcnow()
        duration = int((ended_at - started_at).total_seconds())

        # Generate performance report using Lambda
        try:
            report = lambda_service.invoke_performance_evaluator(
                session_id=session_id,
                conversation_history=session_data.get("transcript", []),
                code_submissions=[],  # TODO: Track code submissions in session
                interview_type=session_data.get("interview_type", "Technical Interview"),
                duration=duration,
                candidate_name=session_data.get("candidate_name", "Candidate"),
                save_to_s3=True
            )

            report_url = report.get("reportUrl", f"s3://prepai-user-data/reports/{session_id}/performance_report.json")
            session_data["performance_report"] = report
            session_data["report_url"] = report_url

        except Exception as e:
            logger.error(f"Error generating performance report: {e}")
            report_url = None

        # Save session with report
        success = s3_service.save_session(session_data)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to end session")

        return EndSessionResponse(
            session_id=session_id,
            status="completed",
            report_url=report_url
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/upload-cv")
async def upload_cv(session_id: str, file: UploadFile = File(...)):
    """Upload and analyze candidate CV with PDF/DOCX support"""
    try:
        session_data = s3_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        # Read file content
        content = await file.read()
        file_extension = file.filename.lower().split('.')[-1]

        # Extract text based on file type
        cv_text = ""

        if file_extension == 'pdf':
            # Use Textract for PDF
            cv_text = textract_service.extract_text_from_pdf(content)
        elif file_extension in ['doc', 'docx']:
            # Use Textract for DOCX
            cv_text = textract_service.extract_text_from_pdf(content)  # Textract handles both
        elif file_extension == 'txt':
            # Direct text extraction
            try:
                cv_text = content.decode('utf-8')
            except:
                raise HTTPException(status_code=400, detail="Unable to decode text file")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_extension}. Supported: PDF, DOCX, TXT"
            )

        if not cv_text.strip():
            raise HTTPException(status_code=400, detail="No text extracted from file")

        # Analyze CV using Lambda
        analysis = lambda_service.invoke_cv_analyzer(cv_text=cv_text)

        # Extract industry-specific skills
        interview_type = session_data.get("interview_type", "")
        industry = "software_engineering"  # Default

        if "solutions architect" in interview_type.lower() or "aws" in interview_type.lower():
            industry = "cloud_architect"
        elif "data" in interview_type.lower():
            industry = "data_science"

        categorized_skills = IndustrySkillExtractor.extract_skills_by_industry(cv_text, industry)

        # Enhance analysis with categorized skills
        analysis['categorized_skills'] = categorized_skills
        analysis['industry'] = industry
        analysis['file_type'] = file_extension

        # Save CV analysis to session
        session_data["cv_analysis"] = analysis
        session_data["cv_uploaded"] = True
        session_data["cv_filename"] = file.filename
        session_data["cv_file_type"] = file_extension
        s3_service.save_session(session_data)

        return JSONResponse(content={
            "success": True,
            "analysis": analysis,
            "message": f"CV uploaded and analyzed successfully ({file_extension.upper()})"
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/cv-analysis")
async def get_cv_analysis(session_id: str):
    """Get CV analysis for a session"""
    try:
        session_data = s3_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        if not session_data.get("cv_uploaded"):
            return JSONResponse(content={"success": True, "analysis": None, "filename": ""})

        return JSONResponse(content={
            "success": True,
            "analysis": session_data.get("cv_analysis", {}),
            "filename": session_data.get("cv_filename", "")
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/performance-report")
async def get_performance_report(session_id: str):
    """Get performance report for a completed interview"""
    try:
        session_data = s3_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        if session_data.get("status") != "completed":
            raise HTTPException(status_code=400, detail="Interview not completed yet")

        report = session_data.get("performance_report")

        if not report:
            raise HTTPException(status_code=404, detail="Performance report not generated")

        return JSONResponse(content={
            "success": True,
            "report": report,
            "report_url": session_data.get("report_url", "")
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
