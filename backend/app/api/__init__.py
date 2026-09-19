from fastapi import APIRouter

api_router = APIRouter()

# Import all route modules
from app.api.routes import auth, hospitals, emergencies, referrals, governor, simulation, demo, notifications

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(hospitals.router, prefix="/hospitals", tags=["Hospitals"])
api_router.include_router(emergencies.router, prefix="/emergencies", tags=["Emergencies"])
api_router.include_router(referrals.router, prefix="/referrals", tags=["Referrals"])
api_router.include_router(governor.router, prefix="/governor", tags=["Governor"])
api_router.include_router(simulation.router, prefix="/simulation", tags=["Simulation"])
api_router.include_router(demo.router, prefix="/demo", tags=["Demo"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
