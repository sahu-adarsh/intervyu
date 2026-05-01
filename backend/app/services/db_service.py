"""
Database service — asyncpg connection pool to Supabase PostgreSQL.

Uses asyncpg directly (not supabase-py PostgREST) for low-latency async queries.
The WebSocket hot path calls append_transcript_message() on every turn — keeping it
as a direct parameterized query keeps it at ~1-2ms vs ~10-20ms through HTTP.

Pool is initialized at app startup via main.py lifespan event.
All functions that write data are called as background tasks from the WebSocket
to stay off the critical latency path.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from app.config.settings import DATABASE_URL

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """Return the shared connection pool, creating it on first call."""
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not configured")
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=5,
            max_size=20,
            command_timeout=10,
            statement_cache_size=100,
        )
        logger.info("asyncpg pool created (min=5 max=20)")
    return _pool


# ---------------------------------------------------------------------------
# SESSION OPERATIONS
# ---------------------------------------------------------------------------

async def create_session(
    user_id: str,
    interview_type: str,
    candidate_name: str = "",
) -> str:
    """Insert a new interview session. Returns the UUID string."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO interview_sessions
                (user_id, interview_type, candidate_name, status, started_at)
            VALUES
                ($1::uuid, $2::interview_type, $3, 'active', NOW())
            RETURNING id::text
            """,
            user_id,
            interview_type,
            candidate_name or "",
        )
    return row["id"]


async def get_session(session_id: str) -> Optional[dict]:
    """Fetch a session row by ID. Returns None if not found."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                id::text            AS session_id,
                user_id::text,
                interview_type::text,
                candidate_name,
                status::text,
                started_at,
                ended_at,
                duration_seconds,
                metadata
            FROM interview_sessions
            WHERE id = $1::uuid
            """,
            session_id,
        )
    if not row:
        return None
    d = dict(row)
    d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
    d["created_at"] = d.pop("started_at").isoformat() if d.get("started_at") else ""
    return d


async def update_session_status(
    session_id: str,
    status: str,
    ended_at: Optional[datetime] = None,
) -> None:
    """Update session status and optional ended_at / duration_seconds."""
    pool = await get_pool()
    if ended_at is None and status == "completed":
        ended_at = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        if ended_at:
            await conn.execute(
                """
                UPDATE interview_sessions
                SET status = $2::session_status,
                    ended_at = $3,
                    duration_seconds = EXTRACT(EPOCH FROM ($3 - started_at))::INT,
                    updated_at = NOW()
                WHERE id = $1::uuid
                """,
                session_id,
                status,
                ended_at,
            )
        else:
            await conn.execute(
                """
                UPDATE interview_sessions
                SET status = $2::session_status, updated_at = NOW()
                WHERE id = $1::uuid
                """,
                session_id,
                status,
            )


# ---------------------------------------------------------------------------
# TRANSCRIPT OPERATIONS
# ---------------------------------------------------------------------------

async def append_transcript_message(
    session_id: str,
    role: str,
    content: str,
    latency_ms: Optional[int] = None,
) -> None:
    """Insert a single transcript message. Called from WebSocket as a background task."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO session_transcripts (session_id, role, content, latency_ms)
            VALUES ($1::uuid, $2, $3, $4)
            """,
            session_id,
            role,
            content,
            latency_ms,
        )


async def get_transcript(session_id: str) -> list[dict]:
    """Return all transcript messages for a session, ordered by created_at."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT role, content, latency_ms, created_at
            FROM session_transcripts
            WHERE session_id = $1::uuid
            ORDER BY created_at ASC
            """,
            session_id,
        )
    return [
        {
            "role": r["role"],
            "content": r["content"],
            "timestamp": r["created_at"].isoformat(),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# CODE SUBMISSION OPERATIONS
# ---------------------------------------------------------------------------

async def save_code_submission(session_id: str, submission: dict) -> str:
    """Insert a code submission record. Returns the new UUID."""
    pool = await get_pool()
    metrics = submission.get("quality_metrics", {}) or {}

    # Map language string to enum (normalize)
    lang = (submission.get("language") or "python").lower()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO code_submissions (
                session_id, code, language, function_name,
                test_results, all_tests_passed, execution_time_ms,
                lines_of_code, cyclomatic_complexity, num_functions,
                num_comments, avg_line_length, has_type_hints, quality_score,
                error_message, submission_number
            ) VALUES (
                $1::uuid, $2, $3::programming_language, $4,
                $5::jsonb, $6, $7,
                $8, $9, $10,
                $11, $12, $13, $14,
                $15, $16
            )
            RETURNING id::text
            """,
            session_id,
            submission.get("code", ""),
            lang,
            submission.get("function_name"),
            json.dumps(submission.get("test_results", [])),
            submission.get("all_tests_passed", False),
            submission.get("execution_time"),
            metrics.get("lines_of_code"),
            metrics.get("cyclomatic_complexity"),
            metrics.get("num_functions"),
            metrics.get("num_comments"),
            metrics.get("avg_line_length"),
            metrics.get("has_type_hints"),
            metrics.get("quality_score"),
            submission.get("error"),
            submission.get("submission_number"),
        )
    return row["id"]


async def get_code_submissions(session_id: str) -> list[dict]:
    """Return all code submissions for a session."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                id::text AS submission_id,
                session_id::text,
                code, language::text, function_name,
                test_results, all_tests_passed, execution_time_ms,
                lines_of_code, cyclomatic_complexity, num_functions,
                num_comments, avg_line_length, has_type_hints, quality_score,
                error_message, submission_number,
                created_at
            FROM code_submissions
            WHERE session_id = $1::uuid
            ORDER BY created_at ASC
            """,
            session_id,
        )
    result = []
    for r in rows:
        d = dict(r)
        d["test_results"] = json.loads(d["test_results"]) if d.get("test_results") else []
        d["timestamp"] = d.pop("created_at").isoformat()
        d["quality_metrics"] = {
            "lines_of_code": d.pop("lines_of_code"),
            "cyclomatic_complexity": d.pop("cyclomatic_complexity"),
            "num_functions": d.pop("num_functions"),
            "num_comments": d.pop("num_comments"),
            "avg_line_length": float(d.pop("avg_line_length") or 0),
            "has_type_hints": d.pop("has_type_hints"),
            "quality_score": float(d.pop("quality_score") or 0),
        }
        result.append(d)
    return result


# ---------------------------------------------------------------------------
# PERFORMANCE REPORT OPERATIONS
# ---------------------------------------------------------------------------

async def save_performance_report(
    session_id: str,
    user_id: str,
    report: dict,
) -> str:
    """Insert a performance report. Returns the new UUID."""
    pool = await get_pool()

    scores = report.get("scores", {}) or {}
    recommendation = report.get("recommendation") or report.get("hire_recommendation")
    if recommendation:
        recommendation = recommendation.lower().replace(" ", "_")
        # Map common Lambda output values to DB enum
        mapping = {
            "hire": "hire",
            "no_hire": "no_hire",
            "strong_hire": "strong_hire",
            "strong_no_hire": "strong_no_hire",
            "inconclusive": "inconclusive",
        }
        recommendation = mapping.get(recommendation, "inconclusive")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO performance_reports (
                session_id, user_id,
                overall_score, recommendation,
                technical_knowledge_score, problem_solving_score,
                communication_score, code_quality_score, cultural_fit_score,
                strengths, improvements, detailed_feedback,
                report_s3_key, metadata
            ) VALUES (
                $1::uuid, $2::uuid,
                $3, $4::recommendation_type,
                $5, $6,
                $7, $8, $9,
                $10::jsonb, $11::jsonb, $12,
                $13, $14::jsonb
            )
            ON CONFLICT (session_id) DO UPDATE SET
                overall_score = EXCLUDED.overall_score,
                recommendation = EXCLUDED.recommendation,
                technical_knowledge_score = EXCLUDED.technical_knowledge_score,
                problem_solving_score = EXCLUDED.problem_solving_score,
                communication_score = EXCLUDED.communication_score,
                code_quality_score = EXCLUDED.code_quality_score,
                cultural_fit_score = EXCLUDED.cultural_fit_score,
                strengths = EXCLUDED.strengths,
                improvements = EXCLUDED.improvements,
                detailed_feedback = EXCLUDED.detailed_feedback,
                report_s3_key = EXCLUDED.report_s3_key,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            RETURNING id::text
            """,
            session_id,
            user_id,
            float(report.get("overallScore", 0) or 0),
            recommendation,
            float(scores.get("technicalKnowledge", 0) or 0),
            float(scores.get("problemSolving", 0) or 0),
            float(scores.get("communication", 0) or 0),
            float(scores.get("codeQuality", 0) or 0),
            float(scores.get("culturalFit", 0) or 0),
            json.dumps(report.get("strengths", [])),
            json.dumps(report.get("improvements", [])),
            report.get("detailedFeedback") or report.get("detailed_feedback"),
            report.get("reportUrl") or report.get("report_s3_key"),
            json.dumps({k: v for k, v in report.items() if k not in (
                "overallScore", "scores", "strengths", "improvements",
                "detailedFeedback", "recommendation", "reportUrl"
            )}),
        )
    return row["id"]


async def get_performance_report(session_id: str) -> Optional[dict]:
    """Fetch the performance report for a completed session."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                id::text,
                session_id::text,
                user_id::text,
                overall_score,
                recommendation::text,
                technical_knowledge_score,
                problem_solving_score,
                communication_score,
                code_quality_score,
                cultural_fit_score,
                strengths,
                improvements,
                detailed_feedback,
                report_s3_key,
                metadata,
                created_at
            FROM performance_reports
            WHERE session_id = $1::uuid
            """,
            session_id,
        )
    if not row:
        return None
    d = dict(row)
    d["strengths"] = json.loads(d["strengths"]) if d.get("strengths") else []
    d["improvements"] = json.loads(d["improvements"]) if d.get("improvements") else []
    d["metadata"] = json.loads(d["metadata"]) if d.get("metadata") else {}
    d["created_at"] = d["created_at"].isoformat() if d.get("created_at") else ""
    # Reshape to match old S3 format so frontend is unaffected
    d["overallScore"] = float(d.pop("overall_score") or 0)
    d["scores"] = {
        "technicalKnowledge": float(d.pop("technical_knowledge_score") or 0),
        "problemSolving": float(d.pop("problem_solving_score") or 0),
        "communication": float(d.pop("communication_score") or 0),
        "codeQuality": float(d.pop("code_quality_score") or 0),
        "culturalFit": float(d.pop("cultural_fit_score") or 0),
    }
    return d


# ---------------------------------------------------------------------------
# CV OPERATIONS
# ---------------------------------------------------------------------------

async def save_cv_document(
    session_id: str,
    filename: str,
    s3_key: str,
    file_size_bytes: Optional[int] = None,
    mime_type: Optional[str] = None,
) -> str:
    """Insert a CV document record. Returns the new UUID."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO cv_documents (session_id, filename, s3_key, file_size_bytes, mime_type)
            VALUES ($1::uuid, $2, $3, $4, $5)
            RETURNING id::text
            """,
            session_id,
            filename,
            s3_key,
            file_size_bytes,
            mime_type,
        )
    return row["id"]


async def save_cv_analysis(
    session_id: str,
    skills_json: dict,
    raw_text: str = "",
    structured_data: dict = None,
) -> str:
    """Upsert CV analysis for a session. Returns the UUID."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO cv_analysis (session_id, skills, raw_text, structured_data)
            VALUES ($1::uuid, $2::jsonb, $3, $4::jsonb)
            ON CONFLICT (session_id) DO UPDATE SET
                skills = EXCLUDED.skills,
                raw_text = EXCLUDED.raw_text,
                structured_data = EXCLUDED.structured_data,
                updated_at = NOW()
            RETURNING id::text
            """,
            session_id,
            json.dumps(skills_json),
            raw_text,
            json.dumps(structured_data or {}),
        )
    return row["id"]


async def delete_cv_analysis(session_id: str, user_id: str) -> bool:
    """Delete cv_analysis and cv_documents rows for a session owned by user_id.
    Returns True if something was deleted, False if not found / not owned."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Verify ownership via interview_sessions
        row = await conn.fetchrow(
            "SELECT user_id::text FROM interview_sessions WHERE id = $1::uuid",
            session_id,
        )
        if not row or row["user_id"] != user_id:
            return False
        await conn.execute(
            "DELETE FROM cv_analysis WHERE session_id = $1::uuid", session_id
        )
        await conn.execute(
            "DELETE FROM cv_documents WHERE session_id = $1::uuid", session_id
        )
    return True


async def update_cv_corrections(session_id: str, corrections: dict) -> None:
    """Update only the structured_data (corrections) column for an existing CV analysis."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE cv_analysis
            SET structured_data = $2::jsonb, updated_at = NOW()
            WHERE session_id = $1::uuid
            """,
            session_id,
            json.dumps(corrections),
        )


async def update_cv_jd_gap(session_id: str, gap_report: dict) -> None:
    """Merge jd_gap_report into structured_data without overwriting corrections or suggestions."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE cv_analysis
            SET structured_data = COALESCE(structured_data, '{}'::jsonb) || $2::jsonb,
                updated_at = NOW()
            WHERE session_id = $1::uuid
            """,
            session_id,
            json.dumps({
                "jd_gap_report": gap_report,
                "jd_gap_generated_at": datetime.now(timezone.utc).isoformat(),
            }),
        )


async def update_cv_ai_suggestions(session_id: str, ai_suggestions: list) -> None:
    """Merge ai_suggestions into structured_data without overwriting corrections.
    Uses JSONB || operator to merge at the top level."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE cv_analysis
            SET structured_data = COALESCE(structured_data, '{}'::jsonb) || $2::jsonb,
                updated_at = NOW()
            WHERE session_id = $1::uuid
            """,
            session_id,
            json.dumps({"ai_suggestions": ai_suggestions}),
        )


async def get_cv_analysis(session_id: str) -> Optional[dict]:
    """Fetch CV analysis for a session."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                cv_analysis.skills,
                cv_analysis.raw_text,
                cv_analysis.structured_data,
                cv_documents.filename
            FROM cv_analysis
            LEFT JOIN cv_documents ON cv_documents.session_id = cv_analysis.session_id
            WHERE cv_analysis.session_id = $1::uuid
            ORDER BY cv_documents.created_at DESC
            LIMIT 1
            """,
            session_id,
        )
    if not row:
        return None
    return {
        "skills": json.loads(row["skills"]) if row.get("skills") else {},
        "raw_text": row.get("raw_text", ""),
        "structured_data": json.loads(row["structured_data"]) if row.get("structured_data") else {},
        "filename": row.get("filename", ""),
    }


async def get_user_cv_analyses(user_id: str) -> list:
    """List all CV analyses for a user, newest first."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                ca.session_id::text,
                ca.skills,
                ca.structured_data,
                ca.raw_text,
                cd.filename,
                cd.created_at AS uploaded_at
            FROM cv_analysis ca
            JOIN interview_sessions s ON s.id = ca.session_id
            JOIN cv_documents cd ON cd.session_id = ca.session_id
            WHERE s.user_id = $1::uuid
            ORDER BY cd.created_at DESC
            """,
            user_id,
        )
    result = []
    for row in rows:
        skills = json.loads(row["skills"]) if row.get("skills") else {}
        structured = json.loads(row["structured_data"]) if row.get("structured_data") else {}
        # Pull out ai_suggestions before returning corrections (so corrections stays clean)
        ai_suggestions = structured.pop("ai_suggestions", None)
        # Extract job metadata stored under _job* keys, leave rest as analysis
        job_metadata = {
            "job_title": skills.pop("_jobTitle", None),
            "job_description": skills.pop("_jobDescription", None),
            "ats_score": skills.pop("_atsScore", None),
            "matched_keywords": skills.pop("_matchedKeywords", None),
            "missing_keywords": skills.pop("_missingKeywords", None),
        }
        result.append({
            "session_id": row["session_id"],
            "filename": row.get("filename") or "",
            "uploaded_at": row["uploaded_at"].isoformat() if row.get("uploaded_at") else None,
            "analysis": skills,
            "corrections": structured,
            "ai_suggestions": ai_suggestions,
            "raw_text": row.get("raw_text") or "",
            **job_metadata,
        })
    return result


async def update_cv_job_metadata(
    session_id: str,
    job_title: Optional[str],
    job_description: Optional[str],
    ats_score: Optional[int],
    matched_keywords: Optional[list],
    missing_keywords: Optional[list],
) -> None:
    """Merge job metadata into the cv_analysis skills JSONB column."""
    pool = await get_pool()
    metadata = {
        "_jobTitle": job_title,
        "_jobDescription": job_description,
        "_atsScore": ats_score,
        "_matchedKeywords": matched_keywords or [],
        "_missingKeywords": missing_keywords or [],
    }
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE cv_analysis
            SET skills = skills || $2::jsonb,
                updated_at = NOW()
            WHERE session_id = $1::uuid
            """,
            session_id,
            json.dumps(metadata),
        )


# ---------------------------------------------------------------------------
# ANALYTICS OPERATIONS  (replace S3 full-scan with targeted SQL)
# ---------------------------------------------------------------------------

async def get_user_aggregate(user_id: str) -> dict:
    """Aggregate stats for one user — single SQL, replaces list_all_sessions()."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(s.id)                                                 AS total,
                COUNT(s.id) FILTER (WHERE s.status = 'completed')          AS completed,
                AVG(pr.overall_score)                                       AS avg_score,
                COUNT(DISTINCT s.interview_type::text)                      AS type_count
            FROM interview_sessions s
            LEFT JOIN performance_reports pr ON pr.session_id = s.id
            WHERE s.user_id = $1::uuid
              AND s.candidate_name != 'Resume Analysis'
            """,
            user_id,
        )
        types_rows = await conn.fetch(
            """
            SELECT interview_type::text AS itype, COUNT(*) AS cnt
            FROM interview_sessions
            WHERE user_id = $1::uuid
              AND candidate_name != 'Resume Analysis'
            GROUP BY interview_type
            """,
            user_id,
        )
        recs_rows = await conn.fetch(
            """
            SELECT pr.recommendation::text AS rec, COUNT(*) AS cnt
            FROM performance_reports pr
            JOIN interview_sessions s ON s.id = pr.session_id
            WHERE s.user_id = $1::uuid
              AND s.candidate_name != 'Resume Analysis'
            GROUP BY pr.recommendation
            """,
            user_id,
        )
    total = int(row["total"] or 0)
    completed = int(row["completed"] or 0)
    avg_score = float(row["avg_score"] or 0)
    return {
        "total_interviews": total,
        "completed_interviews": completed,
        "completion_rate": round((completed / total) * 100, 2) if total > 0 else 0,
        "average_score": round(avg_score, 2),
        "interview_types": {r["itype"]: int(r["cnt"]) for r in types_rows},
        "recommendations": {r["rec"]: int(r["cnt"]) for r in recs_rows},
    }


async def get_user_trends(user_id: str, days: int = 30) -> list[dict]:
    """Daily average scores for a user over the last N days."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                DATE(s.started_at)  AS date,
                AVG(pr.overall_score)::FLOAT AS average_score,
                COUNT(*)            AS num_interviews
            FROM interview_sessions s
            JOIN performance_reports pr ON pr.session_id = s.id
            WHERE s.user_id = $1::uuid
              AND s.candidate_name != 'Resume Analysis'
              AND s.started_at >= NOW() - ($2 || ' days')::INTERVAL
            GROUP BY DATE(s.started_at)
            ORDER BY date ASC
            """,
            user_id,
            str(days),
        )
    return [
        {
            "date": r["date"].isoformat(),
            "average_score": round(r["average_score"], 2),
            "num_interviews": int(r["num_interviews"]),
        }
        for r in rows
    ]


async def get_type_benchmarks(interview_type: str) -> dict:
    """Global percentile benchmarks for a given interview type."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*)                                          AS sample_size,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY pr.overall_score) AS p25,
                PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pr.overall_score) AS p50,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY pr.overall_score) AS p75,
                PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY pr.overall_score) AS p90,
                MIN(pr.overall_score) AS min,
                MAX(pr.overall_score) AS max,
                AVG(pr.overall_score) AS avg
            FROM performance_reports pr
            JOIN interview_sessions s ON s.id = pr.session_id
            WHERE s.interview_type = $1::interview_type
            """,
            interview_type,
        )
    if not row or not row["sample_size"]:
        return {}
    return {
        "sample_size": int(row["sample_size"]),
        "p25": float(row["p25"] or 0),
        "p50": float(row["p50"] or 0),
        "p75": float(row["p75"] or 0),
        "p90": float(row["p90"] or 0),
        "min": float(row["min"] or 0),
        "max": float(row["max"] or 0),
        "avg": float(row["avg"] or 0),
    }


async def get_user_history(user_id: str) -> list[dict]:
    """Full session history for a user, newest first."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                s.id::text              AS session_id,
                s.interview_type::text,
                s.candidate_name,
                s.status::text,
                s.started_at,
                s.ended_at,
                pr.overall_score,
                pr.recommendation::text
            FROM interview_sessions s
            LEFT JOIN performance_reports pr ON pr.session_id = s.id
            WHERE s.user_id = $1::uuid
              AND s.candidate_name != 'Resume Analysis'
            ORDER BY s.started_at DESC
            """,
            user_id,
        )
    return [
        {
            "session_id": r["session_id"],
            "interview_type": r["interview_type"],
            "candidate_name": r["candidate_name"],
            "status": r["status"],
            "date": r["started_at"].isoformat() if r["started_at"] else "",
            "score": float(r["overall_score"]) if r["overall_score"] is not None else None,
            "recommendation": r["recommendation"],
        }
        for r in rows
    ]
