"""
Code Execution Router
Handles code submission, execution, and tracking
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import logging
from datetime import datetime
import uuid

from app.services.lambda_service import LambdaService
from app.services.s3_service import S3Service

logger = logging.getLogger(__name__)
from app.models.code_submission import (
    CodeSubmission,
    TestCaseResult,
    CodeSubmissionTracker
)

router = APIRouter(prefix="/api/code", tags=["code"])
lambda_service = LambdaService()
s3_service = S3Service()


class TestCaseRequest(BaseModel):
    input: str
    expected: str


class CodeExecutionRequest(BaseModel):
    sessionId: str
    code: str
    language: str
    testCases: List[TestCaseRequest]
    functionName: str = "solution"


@router.post("/execute")
async def execute_code(request: CodeExecutionRequest):
    """
    Execute code against test cases and track submission

    Flow:
    1. Execute code via Lambda
    2. Calculate quality metrics
    3. Store submission in session
    4. Return results with metrics
    """
    try:
        # Execute code via Lambda
        result = lambda_service.invoke_code_executor(
            code=request.code,
            language=request.language,
            test_cases=[{"input": tc.input, "expected": tc.expected} for tc in request.testCases],
            function_name=request.functionName
        )

        # Calculate code quality metrics
        quality_metrics = CodeSubmissionTracker.calculate_quality_metrics(
            request.code,
            request.language
        )

        # Parse test results
        test_results = []
        for tr in result.get('testResults', []):
            test_results.append(TestCaseResult(
                test_case=tr['testCase'],
                passed=tr['passed'],
                input=tr['input'],
                expected=tr['expected'],
                actual=tr.get('actual', ''),
                error=tr.get('error')
            ))

        # Create submission record
        submission = CodeSubmission(
            submission_id=str(uuid.uuid4()),
            session_id=request.sessionId,
            timestamp=datetime.utcnow().isoformat(),
            code=request.code,
            language=request.language,
            function_name=request.functionName,
            test_results=test_results,
            all_tests_passed=result.get('allTestsPassed', False),
            execution_time=result.get('executionTime', 0),
            quality_metrics=quality_metrics,
            error=result.get('error')
        )

        # Store in session
        session_data = s3_service.get_session(request.sessionId)
        if session_data:
            if 'code_submissions' not in session_data:
                session_data['code_submissions'] = []

            session_data['code_submissions'].append(submission.to_dict())
            s3_service.save_session(session_data)

        # Return results
        return JSONResponse(content={
            "success": result.get('success', True),
            "testResults": [tr.__dict__ for tr in test_results],
            "allTestsPassed": submission.all_tests_passed,
            "executionTime": submission.execution_time,
            "qualityMetrics": quality_metrics.to_dict(),
            "submissionId": submission.submission_id,
            "error": submission.error
        })

    except Exception as e:
        logger.error(f"Code execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/submissions")
async def get_code_submissions(session_id: str):
    """Get all code submissions for a session"""
    try:
        session_data = s3_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        submissions = session_data.get('code_submissions', [])

        # Parse submissions
        submission_objects = [CodeSubmission.from_dict(s) for s in submissions]

        # Generate summary
        summary = CodeSubmissionTracker.get_submission_summary(submission_objects)

        return JSONResponse(content={
            "success": True,
            "sessionId": session_id,
            "submissions": submissions,
            "summary": summary
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/submissions/{submission_id}")
async def get_code_submission(session_id: str, submission_id: str):
    """Get a specific code submission"""
    try:
        session_data = s3_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        submissions = session_data.get('code_submissions', [])
        submission = next((s for s in submissions if s['submission_id'] == submission_id), None)

        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        return JSONResponse(content={
            "success": True,
            "submission": submission
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/quality-summary")
async def get_quality_summary(session_id: str):
    """Get code quality summary for a session"""
    try:
        session_data = s3_service.get_session(session_id)

        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")

        submissions = session_data.get('code_submissions', [])

        if not submissions:
            return JSONResponse(content={
                "success": True,
                "sessionId": session_id,
                "hasSubmissions": False,
                "message": "No code submissions yet"
            })

        # Parse submissions
        submission_objects = [CodeSubmission.from_dict(s) for s in submissions]

        # Calculate aggregate metrics
        quality_scores = [s.quality_metrics.quality_score for s in submission_objects if s.quality_metrics]
        avg_complexity = sum(s.quality_metrics.cyclomatic_complexity for s in submission_objects if s.quality_metrics) / max(len(quality_scores), 1)
        avg_loc = sum(s.quality_metrics.lines_of_code for s in submission_objects if s.quality_metrics) / max(len(quality_scores), 1)

        return JSONResponse(content={
            "success": True,
            "sessionId": session_id,
            "hasSubmissions": True,
            "totalSubmissions": len(submissions),
            "averageQualityScore": round(sum(quality_scores) / len(quality_scores), 2) if quality_scores else 0,
            "averageComplexity": round(avg_complexity, 2),
            "averageLinesOfCode": round(avg_loc, 2),
            "bestQualityScore": max(quality_scores) if quality_scores else 0,
            "worstQualityScore": min(quality_scores) if quality_scores else 0
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))