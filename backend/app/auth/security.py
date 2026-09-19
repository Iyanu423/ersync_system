import hashlib
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.session import get_db
from app.models.entities import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    )
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if "$" not in hashed_password:
            return False
        salt, key_hex = hashed_password.split("$", 1)
        check_key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            100000
        )
        return secrets.compare_digest(check_key.hex(), key_hex)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return hash_password(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    x_demo_role: Optional[str] = Header(None),
    x_demo_hospital: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Resolves the caller.
    1. A valid JWT bearer token always wins.
    2. Only when DEMO_MODE is on, the X-Demo-Role / X-Demo-Hospital headers can impersonate a role
       (X-Demo-Hospital picks which hospital a HOSPITAL_STAFF persona belongs to).
    3. Otherwise the caller is anonymous. In demo mode anonymous callers get the least-privileged
       PATIENT persona (never admin); outside demo mode they are rejected.
    """
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            username: str = payload.get("sub")
            if username:
                user = db.query(User).filter(User.username == username).first()
                if user:
                    return user
        except JWTError:
            pass

    if not settings.DEMO_MODE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    role = (x_demo_role or "PATIENT").upper()
    role_user = db.query(User).filter(User.role == role).first()
    if not role_user:
        return None
    if role == "HOSPITAL_STAFF" and x_demo_hospital:
        # Transient (never persisted) copy so the header can pick the hospital without touching the DB row
        return User(
            id=role_user.id, username=role_user.username, full_name=role_user.full_name,
            role=role_user.role, hospital_id=x_demo_hospital, is_active=True
        )
    return role_user

def require_admin(user: Optional[User] = Depends(get_current_user)) -> User:
    if not user or user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permissions required"
        )
    return user

def require_hospital_staff(user: Optional[User] = Depends(get_current_user)) -> User:
    if not user or user.role not in ["ADMIN", "HOSPITAL_STAFF"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hospital staff or Admin permissions required"
        )
    return user
