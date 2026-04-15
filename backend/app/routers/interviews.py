import asyncio
import json
import logging
from fastapi import APIRouter, Body, Depends, Form, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from app.limiter import limiter
from app.models.session import TranscriptResponse, TranscriptMessage, EndSessionResponse
from app.services.s3_service import S3Service
from app.services.lambda_service import LambdaService
from app.services.textract_service import TextractService, IndustrySkillExtractor
from app.services.bedrock_service import BedrockService
from app.dependencies.auth import CurrentUser, get_current_user
from app.services import db_service
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])
s3_service = S3Service()
lambda_service = LambdaService()
textract_service = TextractService()
_bedrock_service: Optional[BedrockService] = None


def _get_bedrock() -> BedrockService:
    global _bedrock_service
    if _bedrock_service is None:
        _bedrock_service = BedrockService()
    return _bedrock_service


class CvSuggestionsRequest(BaseModel):
    avg_score: int = 0
    job_description: Optional[str] = None


def _build_suggestions_prompt(raw_text: str, job_description: Optional[str], avg_score: int) -> str:
    jd_section = (
        f"\n<JOB_DESCRIPTION>\n{job_description[:3000]}\n</JOB_DESCRIPTION>\n\nMODE: targeted scoring — match the resume against this specific job description. extract required and preferred skills from the JD. suggestions must reflect actual overlap (or gaps) between resume content and JD requirements.\n"
        if job_description
        else "\nMODE: general ATS readiness — no job description provided. evaluate formatting, structure, and professional keyword density for general ATS compatibility. assess how well this resume would parse and surface in recruiter keyword searches for roles matching the candidate's apparent experience level and field.\n"
    )

    return f"""You are a senior talent acquisition technology analyst who has worked hands-on with all 6 of these enterprise ATS/HCMS platforms. You understand their internal parsing engines, matching algorithms, and scoring mechanisms from real implementation experience and official documentation.

Current average ATS score: {avg_score}/100

<RESUME>
{raw_text[:2500]}
</RESUME>
{jd_section}
## ATS PLATFORM REFERENCE (actual documented behavior)

**WORKDAY** (37% of Fortune 500): proprietary parser. ~30% of resumes flagged unparseable due to formatting. BREAKS on: multi-column layouts (columns merge into garbled lines), tables (scramble job chronology), headers/footers (contact info there is SKIPPED ENTIRELY), text boxes, non-standard fonts. Skills sections not reliably parsed — skills must appear inside experience bullets. HiredScore (semantic ML) weights quantified achievements and relationship clusters ("cross-functional collaboration" + "stakeholder alignment" together > repeating "project management" 5x).

**TALEO** (legacy enterprise): OCR-based, notoriously fragile. LITERAL EXACT KEYWORD MATCH — "project manager" and "project management" are entirely different terms. "CPA" ≠ "Certified Public Accountant". Tense variations ("managed" vs "managing") don't match. Req Rank % score visible to recruiters — low % = immediate dismissal. Disqualification questions cause INSTANT AUTO-REJECTION. STRICTEST of all six.

**iCIMS** (#1 ATS by count): HireAbility ALEX grammar-based NLP — assigns meaning from context, not just pattern matching. Keyword-density counts frequency AND placement. Semantic ML ensemble trained on 4,000+ customers. Related skills and contextual evidence count (past hires data). NYC AEDT bias-audit compliant — AI is advisory, no auto-reject.

**GREENHOUSE** (popular with tech companies): LLM-based modular parser (most modern). Semantic embedding matching — "software engineer" and "web developer" recognized as related. Historically NO auto-scoring by design. New Talent Matching (2024–2025) categorizes as Strong/Good/Partial/Limited. Human interview scorecards remain primary. No auto-reject — biggest risk is recruiter stopping after first batch.

**LEVER** (startups): proprietary parser, handles some columns/tables. Word stemming — "collaborating" matches "collaborate/collaboration". BUT abbreviation-blind: "CPA" ≠ "Certified Public Accountant", "PM" ≠ "Project Manager". NO scoring or ranking whatsoever — entirely dependent on recruiter search behavior.

**SUCCESSFACTORS** (13% of Fortune 500): Textkernel parser (officially documented), 95%+ accuracy. Taxonomy normalization — "Software Engineer", "Application Developer", "Backend Developer" map to same concept. Joule AI for skills extraction. Scanned/image PDFs will NOT parse.

## YOUR TASK

Generate 3–7 specific, high-impact suggestions to improve this resume's ATS performance. Each suggestion must identify a concrete problem with a specific element of THIS resume and explain exactly how to fix it.

CRITICAL RULES:
- NEVER give generic suggestions like "add more keywords" or "quantify your achievements" — always say WHICH bullet, WHICH skill, WHICH section
- Every suggestion must quote or reference SPECIFIC text from the resume — the user should immediately know which part you mean
- "details" must include a before→after rewrite quoting the actual resume text, e.g. "Change 'Improved system performance' to 'Improved system performance by 40%, reducing p99 latency from 800ms to 480ms'"
- Explain WHY it matters using the platform's ACTUAL behavior (e.g., "Taleo's literal matcher won't equate 'React' with 'React.js'")
- Tag "impact" as "critical" only for issues that cause auto-rejection or near-zero parsing (missing contact info in header, disqualification triggers); use "high" for significant score improvements; "medium" and "low" for polish
- Tag "platforms" with which ATS systems specifically benefit from this fix
- If no JD provided, focus on general ATS robustness across all six platforms
- PDF extraction artifacts (#, §, fi, fl ligatures, unicode combining chars) are font rendering noise — do NOT flag as formatting issues
- Sort by impact: critical → high → medium → low

Return ONLY valid JSON, no markdown fences:
{{
  "suggestions": [
    {{
      "summary": "one sentence referencing the specific resume element and its problem",
      "details": [
        "Change '[exact current text]' to '[improved version with specifics]'",
        "Why this specific ATS platform behavior penalizes this",
        "Which platforms benefit and estimated score impact"
      ],
      "impact": "critical | high | medium | low",
      "platforms": ["Workday", "Taleo"]
    }}
  ]
}}"""


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


async def _generate_corrections_background(session_id: str, cv_text: str) -> None:
    """Generate Sonnet CV corrections in background and persist to DB."""
    try:
        corrections = await asyncio.to_thread(
            lambda: lambda_service.invoke_cv_corrections(cv_text=cv_text)
        )
        await db_service.update_cv_corrections(session_id, corrections)
        logger.info(f"CV corrections saved for session {session_id}")
    except Exception as e:
        logger.error(f"Background corrections failed for {session_id}: {e}")


@router.post("/{session_id}/upload-cv")
@limiter.limit("5/hour")
async def upload_cv(
    request: Request,
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    file: UploadFile = File(...),
    extracted_text: Optional[str] = Form(None),
):
    """Upload and analyze candidate CV with PDF/DOCX support.

    The frontend extracts text client-side (pdfjs-dist / mammoth) and sends it
    as the optional `extracted_text` field. When present and substantial we skip
    pdfplumber / Textract entirely, saving ~400 ms and AWS Textract costs.
    Textract is still used automatically when the client sends no text (scanned
    PDFs, unsupported browsers, DOCX mammoth failure, etc.).
    """
    try:
        session_data = await _verify_session_owner(session_id, current_user.user_id)

        content = await file.read()
        file_extension = file.filename.lower().split('.')[-1]

        # Use client-extracted text when the frontend sends it (>200 chars check
        # is done on the client; we re-validate here with a slightly lower bar).
        if extracted_text and len(extracted_text.strip()) > 100:
            cv_text = extracted_text.strip()
            logger.info(
                f"Using client-extracted text for session {session_id} "
                f"({len(cv_text)} chars, skipping server-side extraction)"
            )
        else:
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

        # Analyze CV using Lambda — Sonnet parsing only, runs in thread to unblock event loop
        analysis = await asyncio.to_thread(lambda: lambda_service.invoke_cv_analyzer(cv_text=cv_text))

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

        # Save analysis to DB immediately — corrections will be filled in by background task
        await db_service.save_cv_analysis(
            session_id=session_id,
            skills_json=analysis,
            raw_text=cv_text[:10000],
            structured_data={},
        )

        # Fire Sonnet corrections as background task — doesn't block the response
        asyncio.create_task(_generate_corrections_background(session_id, cv_text))

        return JSONResponse(content={
            "success": True,
            "analysis": analysis,
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


@router.get("/{session_id}/cv-corrections")
async def get_cv_corrections(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get CV corrections for a session.
    Returns {"status": "pending"} if the background Sonnet call hasn't finished yet.
    """
    try:
        await _verify_session_owner(session_id, current_user.user_id)

        cv_data = await db_service.get_cv_analysis(session_id)
        if not cv_data:
            raise HTTPException(status_code=404, detail="No CV analysis found")

        corrections = cv_data.get("structured_data", {})
        if not corrections or not corrections.get("checkers"):
            return JSONResponse(content={"status": "pending"})

        return JSONResponse(content={"status": "ready", "corrections": corrections})

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


@router.post("/{session_id}/link-resume")
async def link_resume(
    session_id: str,
    body: dict = Body(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Copy CV analysis from a previous session into this session so Neerja can use it."""
    try:
        await _verify_session_owner(session_id, current_user.user_id)
        source_session_id = body.get("source_session_id")
        if not source_session_id:
            raise HTTPException(status_code=400, detail="source_session_id required")

        # Verify user owns the source session too
        await _verify_session_owner(source_session_id, current_user.user_id)

        cv = await db_service.get_cv_analysis(source_session_id)
        if not cv:
            raise HTTPException(status_code=404, detail="No CV analysis found for source session")

        await db_service.save_cv_analysis(
            session_id=session_id,
            skills_json=cv.get("skills", {}),
            raw_text=cv.get("raw_text", ""),
            structured_data=cv.get("structured_data", {}),
        )
        return JSONResponse(content={"success": True})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"link-resume error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/cv-suggestions")
async def get_cv_ai_suggestions(
    session_id: str,
    body: CvSuggestionsRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate resume-aware ATS suggestions using Claude. Requires stored CV analysis."""
    try:
        await _verify_session_owner(session_id, current_user.user_id)
        cv_data = await db_service.get_cv_analysis(session_id)
        if not cv_data:
            raise HTTPException(status_code=404, detail="CV analysis not found")

        raw_text = cv_data.get("raw_text") or ""
        if not raw_text.strip():
            # Fall back to reconstructed text from structured analysis
            skills_data = cv_data.get("skills", {})
            parts = []
            if skills_data.get("candidateName"):
                parts.append(skills_data["candidateName"])
            if skills_data.get("summary"):
                parts.append(skills_data["summary"])
            exp = skills_data.get("experience") or []
            for e in exp:
                parts.append(f"{e.get('role', '')} at {e.get('company', '')} — {e.get('context', '')}")
            skills = skills_data.get("skills") or []
            if skills:
                parts.append("Skills: " + ", ".join(skills))
            raw_text = "\n".join(parts)

        if len(raw_text.strip()) < 50:
            return JSONResponse(content={"suggestions": []})

        prompt = _build_suggestions_prompt(raw_text, body.job_description, body.avg_score)
        bedrock = _get_bedrock()

        # Run in thread pool (boto3 is sync)
        loop = asyncio.get_event_loop()
        response_text = await loop.run_in_executor(
            None, lambda: bedrock.invoke_claude_json(prompt, max_tokens=2000)
        )

        # Strip any accidental markdown fences before parsing
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]

        data = json.loads(cleaned)
        suggestions = data.get("suggestions", [])

        # Persist to DB so suggestions survive logout/login
        if suggestions:
            asyncio.create_task(db_service.update_cv_ai_suggestions(session_id, suggestions))

        return JSONResponse(content={"suggestions": suggestions})

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.error(f"cv-suggestions JSON parse error: {e}\nRaw: {response_text[:500]}")
        return JSONResponse(content={"suggestions": []})
    except Exception as e:
        logger.error(f"cv-suggestions error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_id}/cv")
async def delete_cv(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete CV analysis and document records for a session."""
    try:
        deleted = await db_service.delete_cv_analysis(session_id, current_user.user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="CV not found or access denied")
        return JSONResponse(content={"success": True})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV delete error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resumes", include_in_schema=True)
async def list_user_resumes(
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all CV analyses for the authenticated user."""
    try:
        resumes = await db_service.get_user_cv_analyses(current_user.user_id)
        return JSONResponse(content={"success": True, "resumes": resumes})
    except Exception as e:
        logger.error(f"List resumes error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{session_id}/cv-metadata")
async def save_cv_metadata(
    session_id: str,
    body: dict = Body(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Persist job metadata (title, description, ATS score, keywords) for a CV analysis."""
    try:
        await _verify_session_owner(session_id, current_user.user_id)
        await db_service.update_cv_job_metadata(
            session_id=session_id,
            job_title=body.get("job_title"),
            job_description=body.get("job_description"),
            ats_score=body.get("ats_score"),
            matched_keywords=body.get("matched_keywords"),
            missing_keywords=body.get("missing_keywords"),
        )
        return JSONResponse(content={"success": True})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV metadata save error: {e}", exc_info=True)
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
