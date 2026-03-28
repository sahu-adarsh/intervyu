"""
Analytics Router
Performance analytics, benchmarks, and trend analysis
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from app.services.s3_service import S3Service
from app.dependencies.auth import CurrentUser, get_current_user
from typing import List, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
s3_service = S3Service()


@router.get("/aggregate")
async def get_aggregate_analytics(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get aggregate statistics for the authenticated user's interviews"""
    try:
        all_sessions = s3_service.list_all_sessions()

        # Filter to current user's sessions only
        user_sessions = [s for s in all_sessions if s.get("user_id") == current_user.user_id]

        if not user_sessions:
            return JSONResponse(content={
                "success": True,
                "total_interviews": 0,
                "message": "No interview data yet"
            })

        # Calculate aggregates
        total = len(user_sessions)
        completed = sum(1 for s in user_sessions if s.get('status') == 'completed')

        # Interview types distribution
        interview_types = defaultdict(int)
        for session in user_sessions:
            interview_types[session.get('interview_type', 'Unknown')] += 1

        # Average scores
        scores = [
            s.get('performance_report', {}).get('overallScore', 0)
            for s in user_sessions
            if s.get('performance_report')
        ]
        avg_score = sum(scores) / len(scores) if scores else 0

        # Recommendations distribution
        recommendations = defaultdict(int)
        for session in user_sessions:
            rec = session.get('performance_report', {}).get('recommendation')
            if rec:
                recommendations[rec] += 1

        return JSONResponse(content={
            "success": True,
            "total_interviews": total,
            "completed_interviews": completed,
            "completion_rate": round((completed / total) * 100, 2) if total > 0 else 0,
            "average_score": round(avg_score, 2),
            "interview_types": dict(interview_types),
            "recommendations": dict(recommendations),
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/benchmarks/{interview_type}")
async def get_benchmarks(
    interview_type: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get benchmark scores for specific interview type (global aggregates, anonymized)"""
    try:
        all_sessions = s3_service.list_all_sessions()
        type_sessions = [
            s for s in all_sessions
            if s.get('interview_type', '').lower() == interview_type.lower()
            and s.get('performance_report')
        ]

        if not type_sessions:
            return JSONResponse(content={
                "success": True,
                "interview_type": interview_type,
                "has_data": False,
                "message": "No benchmark data available"
            })

        # Calculate benchmarks
        scores = []
        for session in type_sessions:
            report = session.get('performance_report', {})
            if report.get('overallScore'):
                scores.append({
                    'overall': report['overallScore'],
                    'technical': report.get('scores', {}).get('technicalKnowledge', 0),
                    'problem_solving': report.get('scores', {}).get('problemSolving', 0),
                    'communication': report.get('scores', {}).get('communication', 0),
                    'code_quality': report.get('scores', {}).get('codeQuality', 0),
                    'cultural_fit': report.get('scores', {}).get('culturalFit', 0)
                })

        if not scores:
            return JSONResponse(content={
                "success": True,
                "interview_type": interview_type,
                "has_data": False
            })

        def calculate_percentiles(values):
            sorted_values = sorted(values)
            n = len(sorted_values)
            return {
                "p25": sorted_values[n // 4] if n > 0 else 0,
                "p50": sorted_values[n // 2] if n > 0 else 0,
                "p75": sorted_values[3 * n // 4] if n > 0 else 0,
                "p90": sorted_values[9 * n // 10] if n > 0 else 0,
                "min": min(sorted_values) if sorted_values else 0,
                "max": max(sorted_values) if sorted_values else 0,
                "avg": sum(sorted_values) / len(sorted_values) if sorted_values else 0
            }

        benchmarks = {
            "overall": calculate_percentiles([s['overall'] for s in scores]),
            "technical": calculate_percentiles([s['technical'] for s in scores]),
            "problem_solving": calculate_percentiles([s['problem_solving'] for s in scores]),
            "communication": calculate_percentiles([s['communication'] for s in scores]),
            "code_quality": calculate_percentiles([s['code_quality'] for s in scores]),
            "cultural_fit": calculate_percentiles([s['cultural_fit'] for s in scores])
        }

        return JSONResponse(content={
            "success": True,
            "interview_type": interview_type,
            "has_data": True,
            "sample_size": len(scores),
            "benchmarks": benchmarks
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trends")
async def get_trends(
    days: int = 30,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get performance trends over time for the authenticated user"""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        all_sessions = s3_service.list_all_sessions()

        recent_sessions = [
            s for s in all_sessions
            if s.get("user_id") == current_user.user_id
            and datetime.fromisoformat(s.get('created_at', '2000-01-01')) >= cutoff_date
            and s.get('performance_report')
        ]

        if not recent_sessions:
            return JSONResponse(content={
                "success": True,
                "days": days,
                "has_data": False,
                "message": "No data in timeframe"
            })

        # Group by date
        daily_stats = defaultdict(lambda: {'scores': [], 'count': 0})

        for session in recent_sessions:
            date = datetime.fromisoformat(session['created_at']).date().isoformat()
            score = session.get('performance_report', {}).get('overallScore')

            if score:
                daily_stats[date]['scores'].append(score)
                daily_stats[date]['count'] += 1

        # Calculate daily averages
        trend_data = []
        for date in sorted(daily_stats.keys()):
            stats = daily_stats[date]
            avg_score = sum(stats['scores']) / len(stats['scores']) if stats['scores'] else 0

            trend_data.append({
                "date": date,
                "average_score": round(avg_score, 2),
                "num_interviews": stats['count']
            })

        # Calculate overall trend
        if len(trend_data) >= 2:
            first_avg = trend_data[0]['average_score']
            last_avg = trend_data[-1]['average_score']
            trend = "improving" if last_avg > first_avg else "declining" if last_avg < first_avg else "stable"
            change = round(last_avg - first_avg, 2)
        else:
            trend = "insufficient_data"
            change = 0

        return JSONResponse(content={
            "success": True,
            "days": days,
            "has_data": True,
            "trend": trend,
            "change": change,
            "data": trend_data
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_user_history(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get full interview history for the authenticated user"""
    try:
        all_sessions = s3_service.list_all_sessions()
        user_sessions = [
            s for s in all_sessions
            if s.get("user_id") == current_user.user_id
        ]

        if not user_sessions:
            return JSONResponse(content={
                "success": True,
                "has_history": False
            })

        # Sort by date, newest first
        user_sessions.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        scores_over_time = [
            {
                "session_id": s.get('session_id'),
                "date": s.get('created_at'),
                "interview_type": s.get('interview_type'),
                "status": s.get('status'),
                "score": s.get('performance_report', {}).get('overallScore') if s.get('performance_report') else None,
                "recommendation": s.get('performance_report', {}).get('recommendation') if s.get('performance_report') else None,
            }
            for s in user_sessions
        ]

        return JSONResponse(content={
            "success": True,
            "has_history": True,
            "total_interviews": len(user_sessions),
            "completed_interviews": sum(1 for s in user_sessions if s.get('status') == 'completed'),
            "sessions": scores_over_time,
            "latest_score": next(
                (s['score'] for s in scores_over_time if s['score'] is not None), None
            )
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candidate/{candidate_name}/history")
async def get_candidate_history(
    candidate_name: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get interview history filtered by candidate name (scoped to current user)"""
    try:
        all_sessions = s3_service.list_all_sessions()
        candidate_sessions = [
            s for s in all_sessions
            if s.get("user_id") == current_user.user_id
            and s.get('candidate_name', '').lower() == candidate_name.lower()
        ]

        if not candidate_sessions:
            return JSONResponse(content={
                "success": True,
                "candidate_name": candidate_name,
                "has_history": False
            })

        candidate_sessions.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        scores_over_time = [
            {
                "date": s.get('created_at'),
                "interview_type": s.get('interview_type'),
                "score": s.get('performance_report', {}).get('overallScore'),
                "recommendation": s.get('performance_report', {}).get('recommendation')
            }
            for s in candidate_sessions
            if s.get('performance_report')
        ]

        return JSONResponse(content={
            "success": True,
            "candidate_name": candidate_name,
            "has_history": True,
            "total_interviews": len(candidate_sessions),
            "completed_interviews": sum(1 for s in candidate_sessions if s.get('status') == 'completed'),
            "scores_over_time": scores_over_time,
            "latest_score": scores_over_time[0]['score'] if scores_over_time else None
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
