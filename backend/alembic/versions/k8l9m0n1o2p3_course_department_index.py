"""Add optional department field to courses.

Revision ID: k8l9m0n1o2p3
Revises: j7k8l9m0n1o2
Create Date: 2026-06-22 18:40:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k8l9m0n1o2p3"
down_revision: Union[str, None] = "j7k8l9m0n1o2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("courses")}
    indexes = {i["name"] for i in inspector.get_indexes("courses")}

    if "department" not in columns:
        op.add_column("courses", sa.Column("department", sa.String(), nullable=True))
    if "ix_courses_department" not in indexes:
        op.create_index("ix_courses_department", "courses", ["department"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("courses")}
    indexes = {i["name"] for i in inspector.get_indexes("courses")}

    if "ix_courses_department" in indexes:
        op.drop_index("ix_courses_department", table_name="courses")
    if "department" in columns:
        op.drop_column("courses", "department")
