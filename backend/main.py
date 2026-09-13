from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.api.router import api_router
from app.db.session import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    init_db()
    print(f"[{settings.APP_NAME}] Database initialized. Running on {settings.HOST}:{settings.PORT}")
    yield
    # Shutdown
    print(f"[{settings.APP_NAME}] Shutting down...")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="PreConsult AI — Accessible Clinical Intake & Briefing Backend",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "An unexpected server error occurred.",
            "detail": str(exc) if settings.DEBUG else None
        }
    )

# Include master API router under both /api/v1 and /api prefixes for full backward and forward compatibility
app.include_router(api_router, prefix=settings.API_PREFIX)
if settings.API_PREFIX != "/api":
    app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_check": f"{settings.API_PREFIX}/health"
    }

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }

if __name__ == "__main__":
    import os
    import sys
    import socket
    import uvicorn

    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    # Check if port is already in use by an existing backend instance
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        in_use = s.connect_ex((settings.HOST, settings.PORT)) == 0
        if in_use:
            print(f"[{settings.APP_NAME}] Port {settings.PORT} is already in use by an active backend instance.")
            print(f"[{settings.APP_NAME}] Backend is already accessible at http://{settings.HOST}:{settings.PORT}")
            sys.exit(0)

    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG, app_dir=backend_dir)
