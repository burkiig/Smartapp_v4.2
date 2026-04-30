from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification

# Rows older than this are eligible for cleanup (read rows only).
DEFAULT_RETENTION_DAYS = 30


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    # ─────────────────────────────────────────────────────────────────────────
    # Write
    # ─────────────────────────────────────────────────────────────────────────

    def create(
        self,
        user_id: int,
        type: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
    ) -> Notification:
        n = Notification(user_id=user_id, type=type, title=title, body=body, data=data)
        self.db.add(n)
        self.db.commit()
        self.db.refresh(n)
        return n

    def bulk_create(self, records: List[dict]) -> int:
        """
        Efficiently insert many notifications in one DB round-trip.
        Each dict must contain: user_id, type, title, body.
        Optional keys: data.
        Returns the number of rows inserted.
        """
        if not records:
            return 0
        objects = [Notification(**r) for r in records]
        self.db.bulk_save_objects(objects)
        self.db.commit()
        return len(objects)

    # ─────────────────────────────────────────────────────────────────────────
    # Read
    # ─────────────────────────────────────────────────────────────────────────

    def get_for_user(
        self,
        user_id: int,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Notification]:
        q = self.db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            q = q.filter(Notification.is_read == False)  # noqa: E712
        return (
            q.order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def count_unread(self, user_id: int) -> int:
        return (
            self.db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
            .count()
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Mark read
    # ─────────────────────────────────────────────────────────────────────────

    def mark_read(self, notification_id: int, user_id: int) -> Optional[Notification]:
        n = (
            self.db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
            .first()
        )
        if n and not n.is_read:
            n.is_read = True
            n.read_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(n)
        return n

    def mark_all_read(self, user_id: int) -> int:
        now = datetime.now(timezone.utc)
        updated = (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
            .update({"is_read": True, "read_at": now}, synchronize_session=False)
        )
        self.db.commit()
        return updated

    # ─────────────────────────────────────────────────────────────────────────
    # Retention / housekeeping
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def cleanup_old_notifications(
        db: Session,
        retention_days: int = DEFAULT_RETENTION_DAYS,
    ) -> int:
        """
        Delete read notifications older than `retention_days`.

        Unread notifications are intentionally kept regardless of age — a user
        who was offline for >30 days should still see pending alerts when they
        come back.

        Designed to be called from a scheduled job (daily, off-peak hours).
        Returns the number of rows deleted.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        deleted = (
            db.query(Notification)
            .filter(
                Notification.is_read == True,  # noqa: E712
                Notification.created_at < cutoff,
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted
