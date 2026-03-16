from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sessions, interviews, websocket, code, analytics

app = FastAPI(
    title="intervyu Backend API",
    description="AI-Powered Interview Preparation Platform with Real-time Voice Communication",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        # Add production URLs here
    ],
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
