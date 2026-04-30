"""Add dispute, system_setting tables; course default_duration_minutes

Revision ID: a1b2c3d4e5f6
Revises: b373651be828
Create Date: 2026-04-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'b373651be828'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("attendance_disputes"):
        op.create_table(
            "attendance_disputes",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("session_id", sa.Integer(), sa.ForeignKey("attendance_sessions.id"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="pending"),
            sa.Column("instructor_notes", sa.Text(), nullable=True),
            sa.Column("reviewed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_attendance_disputes_id", "attendance_disputes", ["id"])

    if not inspector.has_table("system_settings"):
        op.create_table(
            "system_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("value", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("key"),
        )
        op.create_index("ix_system_settings_id", "system_settings", ["id"])
        op.create_index("ix_system_settings_key", "system_settings", ["key"])

    course_columns = {col["name"] for col in inspector.get_columns("courses")}
    if "default_duration_minutes" not in course_columns:
        op.add_column("courses", sa.Column("default_duration_minutes", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('courses', 'default_duration_minutes')
    op.drop_index('ix_system_settings_key', table_name='system_settings')
    op.drop_index('ix_system_settings_id', table_name='system_settings')
    op.drop_table('system_settings')
    op.drop_index('ix_attendance_disputes_id', table_name='attendance_disputes')
    op.drop_table('attendance_disputes')
