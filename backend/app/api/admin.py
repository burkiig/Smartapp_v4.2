"""Admin-only utilities — distinct department list for leadership scope assignment."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.security.dependencies import require_admin

router = APIRouter()


@router.get("/distinct-departments")
def distinct_departments(
    _admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return sorted unique student department names (admin only)."""
    rows = (
        db.query(User.department)
        .filter(
            User.role == "student",
            User.is_active.is_(True),
            User.department.isnot(None),
            User.department != "",
        )
        .distinct()
        .order_by(User.department)
        .all()
    )
    departments = [row[0].strip() for row in rows if row[0] and row[0].strip()]
    return {"departments": departments}
