"""baseline_postgresql_schema

Revision ID: 0000_baseline
Revises:
Create Date: 2026-04-30 18:45:00.000000
"""

from typing import Sequence, Union

from alembic import op

from app.database.connection import Base
from app.models import (  # noqa: F401
    attendance,
    audit_log,
    course,
    excuse,
    face_reference,
    room,
    session,
    user,
)


revision: str = "0000_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, checkfirst=True)
