import os
import secrets
from typing import List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI GOVERNOR"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Environment & Demo Mode
    ENVIRONMENT: str = "development"
    DEMO_MODE: bool = True
    
    # Database
    DATABASE_URL: str = "sqlite:///./ai_governor.db"
    
    # Security & Auth
    SECRET_KEY: str = "ai-governor-hackathon-secret-key-super-secure-2026-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours for prototype
    
    # Hospital Staleness Thresholds (in minutes)
    STALE_FRESH_MINUTES: int = 15
    STALE_AGING_MINUTES: int = 30
    PENALIZE_STALE_HOSPITALS: bool = True
    EXCLUDE_CRITICALLY_STALE_MINUTES: int = 60   # CRITICAL/HIGH cases skip hospitals whose data is older than this
    LIMITED_STATUS_SCORE_MULTIPLIER: float = 0.85  # ED status LIMITED = reduced capacity, ranked lower (not excluded)

    # Referral workflow
    REFERRAL_TIMEOUT_MINUTES: float = 5.0          # unanswered referrals expire and fail over automatically
    EXPIRY_CHECK_INTERVAL_SECONDS: int = 15
    
    # Governor Scoring Weights (Must sum to 1.0)
    WEIGHT_CAPABILITY: float = 0.40
    WEIGHT_ETA: float = 0.30
    WEIGHT_CAPACITY: float = 0.15
    WEIGHT_SPECIALIST: float = 0.10
    WEIGHT_FRESHNESS: float = 0.05
    
    # AI Configuration
    AI_PROVIDER: str = "mock" # "mock" | "openai" | "local"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = "https://api.openai.com/v1"
    LOCAL_LLM_URL: Optional[str] = "http://localhost:11434/v1"
    AI_MODEL: str = "gpt-4o-mini"
    
    # Routing Configuration
    ROUTING_PROVIDER: str = "deterministic" # "deterministic" | "osrm" | "haversine"
    OSRM_BASE_URL: Optional[str] = "https://router.project-osrm.org"
    AVERAGE_AMBULANCE_SPEED_KMH: float = 45.0 # Average urban speed in Lagos/Abuja traffic
    TRAFFIC_MULTIPLIER: float = 1.35
    
    # CORS
    # Set CORS_ORIGINS as a JSON list in the environment for your deployed frontend,
    # e.g. CORS_ORIGINS='["https://ersync.vercel.app"]'. Localhost and *.vercel.app are allowed by default.
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    CORS_ORIGIN_REGEX: str = r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

# Never run production with the checked-in default signing key.
_DEFAULT_KEY = "ai-governor-hackathon-secret-key-super-secure-2026-production"
if settings.ENVIRONMENT == "production" and settings.SECRET_KEY == _DEFAULT_KEY:
    settings.SECRET_KEY = secrets.token_urlsafe(48)
