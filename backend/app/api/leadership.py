"""Leadership analytics API — dean/rector read-only dashboards."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.security.dependencies import require_leadership
from app.services.leadership_service import LeadershipService, resolve_scope

router = APIRouter()


@router.get("/overview")
def leadership_overview(
    current_user: User = Depends(require_leadership),
    db: Session = Depends(get_db),
):
    scope = resolve_scope(current_user)
    return LeadershipService(db).get_overview(scope)


@router.get("/departments")
def leadership_departments(
    current_user: User = Depends(require_leadership),
    db: Session = Depends(get_db),
):
    """Rector: department comparison. Dean: courses within scoped department."""
    scope = resolve_scope(current_user)
    return LeadershipService(db).get_departments(scope)


@router.get("/at-risk")
def leadership_at_risk(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_leadership),
    db: Session = Depends(get_db),
):
    scope = resolve_scope(current_user)
    return LeadershipService(db).get_at_risk(scope, page=page, page_size=page_size)
