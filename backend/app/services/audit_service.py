from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    action: str,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    resource: Optional[str] = None,
    resource_id: Optional[int] = None,
    detail: Optional[Any] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Append an audit log entry. Failures are suppressed so they never break the main flow."""
    try:
        entry = AuditLog(
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            resource=resource,
            resource_id=resource_id,
            detail=detail,
            ip_address=ip_address,
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
