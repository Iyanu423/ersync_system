from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.entities import AuditLog

class AuditService:
    @staticmethod
    def log(
        db: Session,
        action: str,
        entity_type: str,
        entity_id: str,
        actor: str = "GOVERNOR_ENGINE",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        log_entry = AuditLog(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata or {}
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry

audit_service = AuditService()
