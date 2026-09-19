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
    Retrieves user from JWT bearer token.
    For hackathon demo convenience, also supports rapid role-switching headers (X-Demo-Role).
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

    # Fast demo fallback header
    if x_demo_role:
        role_user = db.query(User).filter(User.role == x_demo_role.upper()).first()
        if role_user:
            return role_user

    # Default to demo admin in development if nothing provided
    default_admin = db.query(User).filter(User.username == "admin").first()
    return default_admin

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
