"""Add excuse upload saga tracking fields.

Revision ID: j7k8l9m0n1o2
Revises: i6j7k8l9m0n1
Create Date: 2026-06-22 18:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "j7k8l9m0n1o2"
down_revision: Union[str, None] = "i6j7k8l9m0n1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("excuses")}

    if "upload_status" not in columns:
        op.add_column(
            "excuses",
            sa.Column("upload_status", sa.String(), nullable=False, server_default="none"),
        )
    if "upload_error" not in columns:
        op.add_column("excuses", sa.Column("upload_error", sa.Text(), nullable=True))
    if "document_mime" not in columns:
        op.add_column("excuses", sa.Column("document_mime", sa.String(), nullable=True))
    if "document_name" not in columns:
        op.add_column("excuses", sa.Column("document_name", sa.String(), nullable=True))

    # Ensure any legacy null rows are normalized.
    bind.execute(sa.text("UPDATE excuses SET upload_status = 'none' WHERE upload_status IS NULL"))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("excuses")}

    if "document_name" in columns:
        op.drop_column("excuses", "document_name")
    if "document_mime" in columns:
        op.drop_column("excuses", "document_mime")
    if "upload_error" in columns:
        op.drop_column("excuses", "upload_error")
    if "upload_status" in columns:
        op.drop_column("excuses", "upload_status")
