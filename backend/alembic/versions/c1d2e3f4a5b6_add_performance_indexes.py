"""Add performance indexes to high-traffic attendance columns

Revision ID: c1d2e3f4a5b6
Revises: 7f45f11dd6c4
Create Date: 2026-05-04 22:20:00.000000

Eklenen indeksler:
  final_attendance_records
    - student_id  → öğrenci geçmişi sorgularını hızlandırır
    - course_id   → ders bazlı filtrelemeler (hoca paneli, export)
    - marked_at   → tarih aralığı sorgularını hızlandırır (ORDER BY + WHERE)

  attendance_attempts
    - student_id  → pipeline sorgusunda öğrenci denemesini bulma
    - session_id  → oturum bazlı toplu sorgular

  attendance_disputes
    - student_id  → öğrencinin kendi itirazlarını listeleme
    - course_id   → hoca bazlı itiraz filtrelemesi (WHERE IN)
    - status      → "pending" itirazları listeleme (dashboard)
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "7f45f11dd6c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _existing_indexes(inspector, table_name: str) -> set:
    """Return the set of existing index names for a table."""
    return {idx["name"] for idx in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── final_attendance_records ──────────────────────────────────────────────
    existing = _existing_indexes(inspector, "final_attendance_records")

    if "ix_final_attendance_records_student_id" not in existing:
        op.create_index(
            "ix_final_attendance_records_student_id",
            "final_attendance_records",
            ["student_id"],
        )
    if "ix_final_attendance_records_course_id" not in existing:
        op.create_index(
            "ix_final_attendance_records_course_id",
            "final_attendance_records",
            ["course_id"],
        )
    if "ix_final_attendance_records_marked_at" not in existing:
        op.create_index(
            "ix_final_attendance_records_marked_at",
            "final_attendance_records",
            ["marked_at"],
        )

    # ── attendance_attempts ───────────────────────────────────────────────────
    existing = _existing_indexes(inspector, "attendance_attempts")

    if "ix_attendance_attempts_student_id" not in existing:
        op.create_index(
            "ix_attendance_attempts_student_id",
            "attendance_attempts",
            ["student_id"],
        )
    if "ix_attendance_attempts_session_id" not in existing:
        op.create_index(
            "ix_attendance_attempts_session_id",
            "attendance_attempts",
            ["session_id"],
        )

    # ── attendance_disputes ───────────────────────────────────────────────────
    existing = _existing_indexes(inspector, "attendance_disputes")

    if "ix_attendance_disputes_student_id" not in existing:
        op.create_index(
            "ix_attendance_disputes_student_id",
            "attendance_disputes",
            ["student_id"],
        )
    if "ix_attendance_disputes_course_id" not in existing:
        op.create_index(
            "ix_attendance_disputes_course_id",
            "attendance_disputes",
            ["course_id"],
        )
    if "ix_attendance_disputes_status" not in existing:
        op.create_index(
            "ix_attendance_disputes_status",
            "attendance_disputes",
            ["status"],
        )


def downgrade() -> None:
    op.drop_index("ix_attendance_disputes_status", table_name="attendance_disputes")
    op.drop_index("ix_attendance_disputes_course_id", table_name="attendance_disputes")
    op.drop_index("ix_attendance_disputes_student_id", table_name="attendance_disputes")
    op.drop_index("ix_attendance_attempts_session_id", table_name="attendance_attempts")
    op.drop_index("ix_attendance_attempts_student_id", table_name="attendance_attempts")
    op.drop_index("ix_final_attendance_records_marked_at", table_name="final_attendance_records")
    op.drop_index("ix_final_attendance_records_course_id", table_name="final_attendance_records")
    op.drop_index("ix_final_attendance_records_student_id", table_name="final_attendance_records")
