"""Add attendance_record_id FK to attendance_disputes

Revision ID: d4e5f6a7b8c9
Revises: c1d2e3f4a5b6
Create Date: 2026-05-04 22:50:00.000000

Yapılan değişiklik:
  attendance_disputes tablosuna attendance_record_id (nullable) kolonu eklendi.

  Bu FK, itirazı doğrudan final_attendance_records tablosundaki ilgili kayda bağlar.
  Önceki dolaylı bağlantı (student_id + session_id çifti) yerine tek bir FK ile:
    - Hoca itirazı onaylarken doğru kaydı bulmak için arama gerekmez
    - Yoklama kaydı silinirse itiraz kaybolmaz; FK SET NULL olur (itiraz korunur)
    - Veri bütünlüğü veritabanı seviyesinde garanti altına alınır

  Geriye dönük uyumluluk:
    - Kolon nullable → eski itirazlar NULL kalır, yeni API hatayla karşılaşmaz
    - review_dispute() direkt FK'yı kullanır, NULL ise yine student+session ile arar
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── Kolon ekle (idempotent) ───────────────────────────────────────────────
    existing_cols = {col["name"] for col in inspector.get_columns("attendance_disputes")}
    if "attendance_record_id" not in existing_cols:
        op.add_column(
            "attendance_disputes",
            sa.Column("attendance_record_id", sa.Integer(), nullable=True),
        )

        # PostgreSQL: gerçek FK kısıtı ekle (CASCADE = SET NULL)
        # SQLite: FK sözdizimi desteklenmez; uygulama katmanı tutarlılığı sağlar
        if bind.dialect.name == "postgresql":
            op.create_foreign_key(
                "fk_attendance_disputes_record_id",
                "attendance_disputes",
                "final_attendance_records",
                ["attendance_record_id"],
                ["id"],
                ondelete="SET NULL",
            )

    # ── İndeks ekle (idempotent) ──────────────────────────────────────────────
    existing_indexes = {
        idx["name"] for idx in inspector.get_indexes("attendance_disputes")
    }
    if "ix_attendance_disputes_attendance_record_id" not in existing_indexes:
        op.create_index(
            "ix_attendance_disputes_attendance_record_id",
            "attendance_disputes",
            ["attendance_record_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_indexes = {
        idx["name"] for idx in inspector.get_indexes("attendance_disputes")
    }
    if "ix_attendance_disputes_attendance_record_id" in existing_indexes:
        op.drop_index(
            "ix_attendance_disputes_attendance_record_id",
            table_name="attendance_disputes",
        )

    if bind.dialect.name == "postgresql":
        op.drop_constraint(
            "fk_attendance_disputes_record_id",
            "attendance_disputes",
            type_="foreignkey",
        )

    existing_cols = {col["name"] for col in inspector.get_columns("attendance_disputes")}
    if "attendance_record_id" in existing_cols:
        op.drop_column("attendance_disputes", "attendance_record_id")
