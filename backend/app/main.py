import os
import logging
from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(name)s %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sessions, interviews, websocket, code, analytics

app = FastAPI(
    title="intervyu Backend API",
    description="AI-Powered Interview Preparation Platform with Real-time Voice Communication",
    version="1.0.0"
)

# CORS Configuration — reads from CORS_ORIGINS env var (comma-separated)
_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
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
