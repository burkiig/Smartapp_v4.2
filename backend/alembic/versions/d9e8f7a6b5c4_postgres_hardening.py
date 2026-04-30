"""postgres_hardening

Revision ID: d9e8f7a6b5c4
Revises: a1b2c3d4e5f6
Create Date: 2026-04-30 18:48:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9e8f7a6b5c4"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Embedding stays binary but uses PostgreSQL BYTEA storage.
        op.execute(
            """
            ALTER TABLE face_references
            ALTER COLUMN embedding TYPE BYTEA;
            """
        )
        op.execute(
            """
            ALTER TABLE final_attendance_records
            ALTER COLUMN verification_steps TYPE JSONB
            USING verification_steps::JSONB;
            """
        )
        op.execute(
            """
            ALTER TABLE audit_logs
            ALTER COLUMN detail TYPE JSONB
            USING detail::JSONB;
            """
        )
        op.execute(
            """
            ALTER TABLE face_references ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "service_only" ON face_references;
            CREATE POLICY "service_only" ON face_references
                FOR ALL
                USING (false);
            """
        )

    with op.batch_alter_table("excuses") as batch_op:
        batch_op.alter_column("document_url", new_column_name="storage_path")


def downgrade() -> None:
    with op.batch_alter_table("excuses") as batch_op:
        batch_op.alter_column("storage_path", new_column_name="document_url")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP POLICY IF EXISTS service_only ON face_references;")
        op.execute(
            """
            ALTER TABLE final_attendance_records
            ALTER COLUMN verification_steps TYPE JSON
            USING verification_steps::JSON;
            """
        )
        op.execute(
            """
            ALTER TABLE audit_logs
            ALTER COLUMN detail TYPE JSON
            USING detail::JSON;
            """
        )
