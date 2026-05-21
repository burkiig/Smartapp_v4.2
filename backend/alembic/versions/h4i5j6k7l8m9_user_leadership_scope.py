"""Add leadership scope columns to users

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-05-21 10:00:00.000000

Adds scope_type and scope_value for dean/rector row-level data isolation.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h4i5j6k7l8m9"
down_revision: Union[str, None] = "g3h4i5j6k7l8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("users")}

    if "scope_type" not in columns:
        op.add_column("users", sa.Column("scope_type", sa.String(), nullable=True))
    if "scope_value" not in columns:
        op.add_column("users", sa.Column("scope_value", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("users")}

    if "scope_value" in columns:
        op.drop_column("users", "scope_value")
    if "scope_type" in columns:
        op.drop_column("users", "scope_type")
