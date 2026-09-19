from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.session import engine
from app.models import entities
from app.api import api_router

# Create database tables
entities.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AI Governor Emergency Coordination System",
        "version": settings.VERSION,
        "demo_mode": settings.DEMO_MODE
    }

@app.get("/")
async def root():
    return {
        "message": "AI Governor — Find the right hospital before it's too late",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": "/api/health"
    }