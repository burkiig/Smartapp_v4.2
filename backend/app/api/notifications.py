"""
Notifications API — /api/v1/notifications

Endpoints
---------
GET    /                  — paginated list + unread_count
GET    /count             — lightweight unread count (for bell badge polling)
PATCH  /{id}/read         — mark a single notification as read
PATCH  /read-all          — mark all unread as read
POST   /broadcast         — admin: fan-out system announcement to a role
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.repositories.notification_repo import NotificationRepository
from app.security.dependencies import get_current_user, require_admin
from app.services.notification_service import broadcast_to_role

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BroadcastRequest(BaseModel):
    target_role: str          # "all" | "student" | "instructor"
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/count", summary="Unread notification count (lightweight)")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns only the unread badge count.
    Designed to be polled frequently (every 15–30 s) by the notification bell.
    """
    count = NotificationRepository(db).count_unread(current_user.id)
    return {"unread_count": count}


@router.get("/", summary="List notifications")
def list_notifications(
    unread_only: bool = Query(default=False, description="Return only unread items"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repo = NotificationRepository(db)
    items = repo.get_for_user(
        current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    unread_count = repo.count_unread(current_user.id)
    return {
        "unread_count": unread_count,
        "notifications": [NotificationOut.model_validate(n) for n in items],
    }


@router.patch("/read-all", summary="Mark all notifications as read")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = NotificationRepository(db).mark_all_read(current_user.id)
    return {"success": True, "updated": updated}


@router.patch("/{notification_id}/read", summary="Mark a notification as read")
def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = NotificationRepository(db).mark_read(notification_id, current_user.id)
    if not n:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    return {"success": True}


@router.post("/broadcast", summary="Admin: broadcast announcement to a role")
def broadcast(
    payload: BroadcastRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Fan-out a system notification to every active user of `target_role`.
    Allowed values: "all" | "student" | "instructor".
    """
    allowed_roles = {"all", "student", "instructor"}
    if payload.target_role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz hedef rol. İzin verilenler: {sorted(allowed_roles)}",
        )

    count = broadcast_to_role(
        db=db,
        target_role=payload.target_role,
        type="system",
        title=payload.title,
        body=payload.body,
        data=payload.data,
    )
    return {
        "success": True,
        "recipients": count,
        "target_role": payload.target_role,
    }
