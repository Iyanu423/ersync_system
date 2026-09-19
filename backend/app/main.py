import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.session import engine
from app.models import entities
from app.api import api_router

from app.database.init_db import init_db

# Create database tables and auto-seed if empty
init_db()

logger = logging.getLogger(__name__)


async def _referral_expiry_loop():
    """Background timer: unanswered referrals time out and fail over on their own."""
    from app.database.session import SessionLocal
    from app.services.referral_service import referral_service
    while True:
        await asyncio.sleep(settings.EXPIRY_CHECK_INTERVAL_SECONDS)
        db = SessionLocal()
        try:
            referral_service.expire_stale_referrals(db)
        except Exception:
            logger.exception("Referral expiry check failed")
        finally:
            db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_referral_expiry_loop())
    yield
    task.cancel()


app = FastAPI(
    lifespan=lifespan,
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
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=False,   # auth is a bearer header, not cookies
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