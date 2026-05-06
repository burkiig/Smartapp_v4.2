from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
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


@router.get("/face-failures")
def get_face_failures(
    days: int = Query(default=30, ge=1, le=365, description="Kaç günlük veri"),
    min_failures: int = Query(default=1, ge=1, description="Minimum başarısız deneme sayısı"),
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Son N günde yüz doğrulaması başarısız olan kullanıcıları listeler.
    Kayıt fotoğrafında sorun olan (karanlık, gözlüklü vb.) öğrencileri
    tespit etmek ve yönetici müdahalesini kolaylaştırmak için kullanılır.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # All face verify events in the window (both login and attendance)
    verify_logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.action == "verify",
            AuditLog.resource == "face_references",
            AuditLog.created_at >= cutoff,
        )
        .order_by(AuditLog.created_at.desc())
        .all()
    )

    # Aggregate per user — Python-side for SQLite/PostgreSQL compatibility
    stats: dict = defaultdict(lambda: {
        "fail_count": 0,
        "success_count": 0,
        "last_fail_at": None,
        "last_success_at": None,
        "last_confidence": None,
        "confidences": [],           # rolling list to compute avg
    })

    for log in verify_logs:
        if log.actor_id is None:
            continue
        detail  = log.detail or {}
        verified = detail.get("verified", True)
        sim      = detail.get("similarity")
        s = stats[log.actor_id]

        if not verified:
            s["fail_count"] += 1
            if s["last_fail_at"] is None or log.created_at > s["last_fail_at"]:
                s["last_fail_at"]    = log.created_at
                s["last_confidence"] = sim
            if sim is not None:
                s["confidences"].append(sim)
        else:
            s["success_count"] += 1
            if s["last_success_at"] is None or log.created_at > s["last_success_at"]:
                s["last_success_at"] = log.created_at

    # Keep only users that meet the min_failures threshold
    flagged_ids = [
        uid for uid, s in stats.items() if s["fail_count"] >= min_failures
    ]

    if not flagged_ids:
        return {"days": days, "total": 0, "users": []}

    user_map = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(flagged_ids)).all()
    }

    results = []
    for uid in flagged_ids:
        user = user_map.get(uid)
        if not user:
            continue
        s = stats[uid]
        total_attempts = s["fail_count"] + s["success_count"]
        avg_conf = (
            round(sum(s["confidences"]) / len(s["confidences"]), 4)
            if s["confidences"] else None
        )
        results.append({
            "user_id":         uid,
            "name":            user.name,
            "username":        user.username,
            "email":           user.email,
            "student_number":  user.student_number,
            "fail_count":      s["fail_count"],
            "success_count":   s["success_count"],
            "total_attempts":  total_attempts,
            "fail_rate":       round(s["fail_count"] / max(total_attempts, 1) * 100, 1),
            "avg_confidence":  avg_conf,
            "last_confidence": s["last_confidence"],
            "last_fail_at":    s["last_fail_at"].isoformat() if s["last_fail_at"] else None,
            "last_success_at": s["last_success_at"].isoformat() if s["last_success_at"] else None,
        })

    results.sort(key=lambda x: x["fail_count"], reverse=True)
    return {"days": days, "total": len(results), "users": results}
