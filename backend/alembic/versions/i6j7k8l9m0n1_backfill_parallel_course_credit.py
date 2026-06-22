# pyright: reportMissingImports=false
"""Backfill course credit for parallel-course attendance data.

Revision ID: i6j7k8l9m0n1
Revises: h4i5j6k7l8m9
Create Date: 2026-06-22 17:55:00.000000
"""

from typing import Dict, Optional, Sequence, Tuple, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i6j7k8l9m0n1"
down_revision: Union[str, None] = "h4i5j6k7l8m9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _resolve_course_id(
    bind,
    student_id: int,
    session_id: int,
    session_cache: Dict[int, Tuple[int, Optional[int]]],
    resolution_cache: Dict[Tuple[int, int], Optional[int]],
) -> Optional[int]:
    cache_key = (student_id, session_id)
    if cache_key in resolution_cache:
        return resolution_cache[cache_key]

    if session_id not in session_cache:
        session_row = bind.execute(
            sa.text(
                """
                SELECT s.course_id AS session_course_id, c.shared_class_id AS shared_class_id
                FROM attendance_sessions s
                JOIN courses c ON c.id = s.course_id
                WHERE s.id = :session_id
                """
            ),
            {"session_id": session_id},
        ).mappings().first()
        if not session_row:
            session_cache[session_id] = (-1, None)
        else:
            session_cache[session_id] = (
                int(session_row["session_course_id"]),
                session_row["shared_class_id"],
            )

    session_course_id, shared_class_id = session_cache[session_id]
    if session_course_id <= 0:
        resolution_cache[cache_key] = None
        return None

    if shared_class_id is None:
        rows = bind.execute(
            sa.text(
                """
                SELECT e.course_id
                FROM enrollments e
                WHERE e.student_id = :student_id
                  AND e.course_id = :session_course_id
                """
            ),
            {"student_id": student_id, "session_course_id": session_course_id},
        ).fetchall()
    else:
        rows = bind.execute(
            sa.text(
                """
                SELECT e.course_id
                FROM enrollments e
                JOIN courses c ON c.id = e.course_id
                WHERE e.student_id = :student_id
                  AND (e.course_id = :session_course_id OR c.shared_class_id = :shared_class_id)
                """
            ),
            {
                "student_id": student_id,
                "session_course_id": session_course_id,
                "shared_class_id": shared_class_id,
            },
        ).fetchall()

    candidate_ids = sorted({int(row[0]) for row in rows})
    if not candidate_ids:
        resolution_cache[cache_key] = None
        return None

    candidate_ids.sort(key=lambda cid: (0 if cid == session_course_id else 1, cid))
    resolved = candidate_ids[0]
    resolution_cache[cache_key] = resolved
    return resolved


def _backfill_table_course_id(
    bind,
    table_name: str,
    id_col: str,
    student_col: str,
    session_col: str,
) -> None:
    session_cache: Dict[int, Tuple[int, Optional[int]]] = {}
    resolution_cache: Dict[Tuple[int, int], Optional[int]] = {}
    rows = bind.execute(
        sa.text(
            f"""
            SELECT {id_col} AS row_id, {student_col} AS student_id, {session_col} AS session_id, course_id
            FROM {table_name}
            WHERE {session_col} IS NOT NULL
            """
        )
    ).mappings().all()

    for row in rows:
        resolved_course_id = _resolve_course_id(
            bind=bind,
            student_id=int(row["student_id"]),
            session_id=int(row["session_id"]),
            session_cache=session_cache,
            resolution_cache=resolution_cache,
        )
        if resolved_course_id is None:
            continue
        if int(row["course_id"]) == resolved_course_id:
            continue
        bind.execute(
            sa.text(
                f"""
                UPDATE {table_name}
                SET course_id = :course_id
                WHERE {id_col} = :row_id
                """
            ),
            {"course_id": resolved_course_id, "row_id": int(row["row_id"])},
        )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "final_attendance_records" in tables:
        _backfill_table_course_id(
            bind=bind,
            table_name="final_attendance_records",
            id_col="id",
            student_col="student_id",
            session_col="session_id",
        )

    if "attendance_disputes" in tables:
        _backfill_table_course_id(
            bind=bind,
            table_name="attendance_disputes",
            id_col="id",
            student_col="student_id",
            session_col="session_id",
        )

    if "excuses" in tables:
        _backfill_table_course_id(
            bind=bind,
            table_name="excuses",
            id_col="id",
            student_col="student_id",
            session_col="session_id",
        )


def downgrade() -> None:
    # Data backfill migration is intentionally not reversible.
    pass
