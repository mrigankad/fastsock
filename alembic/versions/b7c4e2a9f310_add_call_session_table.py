"""Add call_session table

Revision ID: b7c4e2a9f310
Revises: adefca12d281
Create Date: 2026-02-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c4e2a9f310"
down_revision: Union[str, None] = "adefca12d281"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "call_session",
        sa.Column("call_id", sa.String(length=36), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=True),
        sa.Column("caller_id", sa.Integer(), nullable=False),
        sa.Column("callee_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.ForeignKeyConstraint(["callee_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["caller_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["room_id"], ["chatroom.id"]),
        sa.PrimaryKeyConstraint("call_id"),
    )
    op.create_index(op.f("ix_call_session_call_id"), "call_session", ["call_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_call_session_call_id"), table_name="call_session")
    op.drop_table("call_session")
