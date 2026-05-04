"""initial_schema — face_references timezone + JSON→JSONB

Revision ID: 7f45f11dd6c4
Revises: f1e2d3c4b5a6
Create Date: 2026-05-04 21:17:43.887516

Yapilan degisiklikler:
  1. face_references.created_at : TIMESTAMP (naive)  -> TIMESTAMPTZ (timezone-aware)
  2. face_references.updated_at : TIMESTAMP (naive)  -> TIMESTAMPTZ (timezone-aware)
  3. audit_logs.detail          : JSON               -> JSONB  (binary, indexlenebilir)
  4. final_attendance_records
     .verification_steps        : JSON               -> JSONB  (binary, indexlenebilir)

JSONB neden tercih edilmeli:
  - Daha hizli sorgu (binary parse, text JSON gibi her seferinde parse etmez)
  - GIN index destegi (JSON sutununda WHERE icinde arama yapilabilir)
  - PostgreSQL best-practice: yeni kolonlar icin her zaman JSONB kullan
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "7f45f11dd6c4"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1-2. face_references: naive TIMESTAMP -> TIMESTAMPTZ
    # Mevcut satirlardaki degerler UTC kabul edilerek donusturulur.
    op.alter_column(
        "face_references",
        "created_at",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )
    op.alter_column(
        "face_references",
        "updated_at",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using="updated_at AT TIME ZONE 'UTC'",
    )

    # 3-4. JSON -> JSONB: veri kaybi yok, JSONB JSON'in superkumesi
    # USING cast PostgreSQL'in otomatik donusturme mekanizmasini kullanir.
    op.alter_column(
        "audit_logs",
        "detail",
        existing_type=postgresql.JSON(astext_type=sa.Text()),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True,
        postgresql_using="detail::jsonb",
    )
    op.alter_column(
        "final_attendance_records",
        "verification_steps",
        existing_type=postgresql.JSON(astext_type=sa.Text()),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True,
        postgresql_using="verification_steps::jsonb",
    )


def downgrade() -> None:
    # JSONB -> JSON: superkumeden alt kumeye, veri kaybi yok
    op.alter_column(
        "final_attendance_records",
        "verification_steps",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=postgresql.JSON(astext_type=sa.Text()),
        existing_nullable=True,
        postgresql_using="verification_steps::json",
    )
    op.alter_column(
        "audit_logs",
        "detail",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=postgresql.JSON(astext_type=sa.Text()),
        existing_nullable=True,
        postgresql_using="detail::json",
    )
    # TIMESTAMPTZ -> TIMESTAMP
    op.alter_column(
        "face_references",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
        postgresql_using="updated_at AT TIME ZONE 'UTC'",
    )
    op.alter_column(
        "face_references",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )
