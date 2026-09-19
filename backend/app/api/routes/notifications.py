from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import Notification
from app.schemas.schemas import NotificationResponse
from app.auth.security import get_current_user

router = APIRouter()


@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    recipient_type: Optional[str] = None,
    recipient_id: Optional[str] = None,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Recent alerts. HOSPITAL_STAFF only ever see their own hospital's alerts."""
    q = db.query(Notification)
    if current_user and current_user.role == "HOSPITAL_STAFF":
        q = q.filter(Notification.recipient_type == "HOSPITAL", Notification.recipient_id == current_user.hospital_id)
    else:
        if recipient_type:
            q = q.filter(Notification.recipient_type == recipient_type)
        if recipient_id:
            q = q.filter(Notification.recipient_id == recipient_id)
    return q.order_by(Notification.created_at.desc()).limit(min(limit, 100)).all()


@router.post("/{notification_id}/read", response_model=dict)
def mark_read(notification_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.status = "READ"
    db.commit()
    return {"id": n.id, "status": n.status}
