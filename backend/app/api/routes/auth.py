from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.config import settings
from app.database.session import get_db
from app.models.entities import User
from app.auth.security import get_current_user, create_access_token, require_admin, require_hospital_staff
from app.schemas.schemas import UserLogin, Token, UserResponse, UserCreate

router = APIRouter()

@router.post("/token", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not user.verify_password(login_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            hospital_id=user.hospital_id,
            is_active=user.is_active
        )
    }

@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    from app.auth.security import get_password_hash
    hashed = get_password_hash(user_data.password)
    
    user = User(
        username=user_data.username,
        hashed_password=hashed,
        full_name=user_data.full_name,
        role=user_data.role,
        hospital_id=user_data.hospital_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        hospital_id=user.hospital_id,
        is_active=user.is_active
    )

@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role,
        hospital_id=current_user.hospital_id,
        is_active=current_user.is_active
    )

@router.get("/demo-tokens", tags=["Demo"])
def demo_tokens():
    """Generate demo tokens for rapid role switching during hackathon"""
    from app.auth.security import get_password_hash
    
    # Generate tokens for all three demo roles
    admin_token = create_access_token(data={"sub": "admin"})
    staff_token = create_access_token(data={"sub": "staff"})
    patient_token = create_access_token(data={"sub": "patient"})
    
    return {
        "admin": {"token": admin_token, "username": "admin", "password": "admin123", "role": "ADMIN"},
        "hospital_staff": {"token": staff_token, "username": "staff", "password": "staff123", "role": "HOSPITAL_STAFF", "hospital": "Lagos Central Trauma Centre"},
        "patient": {"token": patient_token, "username": "patient", "password": "patient123", "role": "PATIENT"}
    }