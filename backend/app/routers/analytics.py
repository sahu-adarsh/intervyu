"""
Analytics Router
Performance analytics, benchmarks, and trend analysis
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from app.dependencies.auth import CurrentUser, get_current_user
from app.services import db_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/aggregate")
async def get_aggregate_analytics(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Aggregate stats for the authenticated user"""
    try:
        stats = await db_service.get_user_aggregate(current_user.user_id)
        return JSONResponse(content={"success": True, **stats})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/benchmarks/{interview_type}")
async def get_benchmarks(
    interview_type: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Global percentile benchmarks for a given interview type"""
    try:
        data = await db_service.get_type_benchmarks(interview_type)
        if not data:
            return JSONResponse(content={
                "success": True,
                "interview_type": interview_type,
                "has_data": False,
                "message": "No benchmark data available",
            })
        return JSONResponse(content={
            "success": True,
            "interview_type": interview_type,
            "has_data": True,
            **data,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trends")
async def get_trends(
    days: int = 30,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Performance trend over last N days for the authenticated user"""
    try:
        trend_data = await db_service.get_user_trends(current_user.user_id, days)
        if not trend_data:
            return JSONResponse(content={
                "success": True,
                "days": days,
                "has_data": False,
                "message": "No data in timeframe",
            })

        trend = "insufficient_data"
        change = 0
        if len(trend_data) >= 2:
            first_avg = trend_data[0]["average_score"]
            last_avg = trend_data[-1]["average_score"]
            trend = "improving" if last_avg > first_avg else "declining" if last_avg < first_avg else "stable"
            change = round(last_avg - first_avg, 2)

        return JSONResponse(content={
            "success": True,
            "days": days,
            "has_data": True,
            "trend": trend,
            "change": change,
            "data": trend_data,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_user_history(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Full interview history for the authenticated user"""
    try:
        sessions = await db_service.get_user_history(current_user.user_id)
        return JSONResponse(content={
            "success": True,
            "has_history": bool(sessions),
            "total_interviews": len(sessions),
            "completed_interviews": sum(1 for s in sessions if s.get("status") == "completed"),
            "sessions": sessions,
            "latest_score": next(
                (s["score"] for s in sessions if s["score"] is not None), None
            ),
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candidate/{candidate_name}/history")
async def get_candidate_history(
    candidate_name: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """History filtered by candidate name (scoped to current user)"""
    try:
        all_sessions = await db_service.get_user_history(current_user.user_id)
        candidate_sessions = [
            s for s in all_sessions
            if (s.get("candidate_name") or "").lower() == candidate_name.lower()
        ]
        if not candidate_sessions:
            return JSONResponse(content={
                "success": True,
                "candidate_name": candidate_name,
                "has_history": False,
            })
        return JSONResponse(content={
            "success": True,
            "candidate_name": candidate_name,
            "has_history": True,
            "total_interviews": len(candidate_sessions),
            "completed_interviews": sum(1 for s in candidate_sessions if s.get("status") == "completed"),
            "scores_over_time": [
                {"date": s["date"], "interview_type": s["interview_type"],
                 "score": s["score"], "recommendation": s["recommendation"]}
                for s in candidate_sessions if s["score"] is not None
            ],
            "latest_score": next(
                (s["score"] for s in candidate_sessions if s["score"] is not None), None
            ),
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
