"""User management privilege checks — prevent role/scope escalation."""

from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

PRIVILEGED_ROLES = frozenset({"admin", "dean", "rector"})


def normalize_leadership_scope(role: str, scope_type: str | None, scope_value: str | None) -> tuple[str | None, str | None]:
    """Derive scope fields from role — server-side source of truth."""
    if role == "rector":
        return "university", None
    if role == "dean":
        value = (scope_value or "").strip()
        if not value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dekan rolü için bölüm (scope_value) zorunludur",
            )
        return "department", value
    return None, None


def apply_create_scope(data: UserCreate) -> UserCreate:
    """Normalize scope on user creation (admin-only endpoint)."""
    scope_type, scope_value = normalize_leadership_scope(
        data.role, data.scope_type, data.scope_value
    )
    return data.model_copy(update={"scope_type": scope_type, "scope_value": scope_value})


def enforce_update_privileges(
    current_user: User,
    target_user: User,
    data: UserUpdate,
) -> dict:
    """
    Reject non-admin attempts to change role/scope.
    Normalize scope for admin when assigning leadership roles.
    """
    updates = data.model_dump(exclude_none=True)

    role_changing = "role" in updates and updates["role"] != target_user.role
    scope_type_changing = "scope_type" in updates and updates["scope_type"] != target_user.scope_type
    scope_value_changing = "scope_value" in updates and updates["scope_value"] != target_user.scope_value

    if current_user.role != "admin":
        if role_changing or scope_type_changing or scope_value_changing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu yetki seviyesini değiştiremezsiniz",
            )
        updates.pop("role", None)
        updates.pop("scope_type", None)
        updates.pop("scope_value", None)
        return updates

    effective_role = updates.get("role", target_user.role)

    if "role" in updates or "scope_type" in updates or "scope_value" in updates:
        scope_type, scope_value = normalize_leadership_scope(
            effective_role,
            updates.get("scope_type", target_user.scope_type),
            updates.get("scope_value", target_user.scope_value),
        )
        updates["scope_type"] = scope_type
        updates["scope_value"] = scope_value

    if effective_role not in ("dean", "rector") and "role" in updates:
        updates["scope_type"] = None
        updates["scope_value"] = None

    return updates
