import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(name)s %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.limiter import limiter
from app.routers import sessions, interviews, websocket, code, analytics, auth

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: warm DB connection pool. Shutdown: close it."""
    from app.config.settings import DATABASE_URL
    if DATABASE_URL:
        try:
            from app.services import db_service
            await db_service.get_pool()
            logger.info("PostgreSQL connection pool initialized")
        except Exception as exc:
            logger.warning(f"DB pool init skipped (Supabase not configured?): {exc}")
    yield
    # Shutdown
    try:
        from app.services import db_service
        if db_service._pool:
            await db_service._pool.close()
            logger.info("PostgreSQL connection pool closed")
    except Exception:
        pass


app = FastAPI(
    title="intervyu Backend API",
    description="AI-Powered Interview Preparation Platform with Real-time Voice Communication",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration — reads from CORS_ORIGINS env var (comma-separated)
_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(interviews.router)
app.include_router(websocket.router)
app.include_router(code.router)
app.include_router(analytics.router)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "intervyu Backend API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "intervyu-backend"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
