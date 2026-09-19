from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.entities import Notification

class NotificationService:
    @staticmethod
    def send(
        db: Session,
        recipient_type: str, # PATIENT, HOSPITAL, ADMIN, SYSTEM
        type: str,
        title: str,
        message: str,
        recipient_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Notification:
        notif = Notification(
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            type=type,
            title=title,
            message=message,
            metadata_json=metadata or {},
            status="DELIVERED"
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif

    @staticmethod
    def list_recent(db: Session, limit: int = 50) -> List[Notification]:
        return db.query(Notification).order_by(Notification.created_at.desc()).limit(limit).all()

notification_service = NotificationService()
