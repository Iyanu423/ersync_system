from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.schemas import OneClickDemoResponse
from app.services.demo_service import demo_service
from app.auth.security import require_admin, get_current_user
from app.core.config import settings

router = APIRouter()

@router.post("/scenario/mass-casualty", response_model=OneClickDemoResponse)
async def run_mass_casualty_demo(
    db: Session = Depends(get_db),
    current_user = Depends(require_admin),
):
    """One-Click Hackathon Demonstration.

    Motorcycle accident -> CRITICAL triage -> Hospital #1 rejection ->
    Auto-failover to Hospital #2 -> Acceptance -> Bed reserved.

    Note: During development/demo, some deployments rely on the
    X-Demo-* headers instead of a full Bearer token.
    """
    # If we got an authenticated user, allow.
    # Otherwise, allow ADMIN for demo mode when frontend sends demo headers.
    if current_user is None:
        # Try reading the demo headers via get_current_user (it can fall back)
        try:
            user_fallback = get_current_user()
        except Exception:
            user_fallback = None
        current_user = user_fallback

    if not current_user or current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin permissions required")

    try:
        result = await demo_service.run_one_click_scenario(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demo scenario failed: {str(e)}")