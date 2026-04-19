from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database.connection import get_db
from app.models.audit_log import AuditLog
from app.security.dependencies import require_admin

router = APIRouter()


@router.get("/")
def get_audit_logs(
    action: Optional[str] = None,
    actor_id: Optional[int] = None,
    resource: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if actor_id:
        q = q.filter(AuditLog.actor_id == actor_id)
    if resource:
        q = q.filter(AuditLog.resource == resource)

    total = q.count()
    logs = q.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "logs": [
            {
                "id": log.id,
                "actor_id": log.actor_id,
                "actor_role": log.actor_role,
                "action": log.action,
                "resource": log.resource,
                "resource_id": log.resource_id,
                "detail": log.detail,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
