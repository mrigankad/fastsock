"""Messaging v2 — reply_to, edited_at, forwarding, expiry

Revision ID: 008_messaging_v2
Revises: 007_auth_privacy
Create Date: 2026-02-14

Adds to message:
  - reply_to_id  (thread reply reference)
  - forwarded_from (forward reference)
  - edited_at
  - expires_at (disappearing messages)
  - is_silent (no notification)

New tables:
  - link_preview
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "008_messaging_v2"
down_revision: Union[str, None] = "007_auth_privacy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Get existing columns to skip already-added ones (idempotent for SQLite)
    from alembic import op as _op
    from sqlalchemy import inspect, text
    bind = _op.get_bind()
    existing = {col["name"] for col in inspect(bind).get_columns("message")}

    if "reply_to_id" not in existing:
        op.add_column("message", sa.Column("reply_to_id", sa.Integer(), nullable=True))
    if "forwarded_from" not in existing:
        op.add_column("message", sa.Column("forwarded_from", sa.Integer(), nullable=True))
    if "edited_at" not in existing:
        op.add_column("message", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))
    if "expires_at" not in existing:
        op.add_column("message", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    if "is_silent" not in existing:
        op.add_column("message", sa.Column("is_silent", sa.Boolean(), nullable=False, server_default=sa.false()))

    # Indexes for common access patterns
    op.create_index("ix_message_sender_ts", "message", ["sender_id", "timestamp"])
    op.create_index("ix_message_room_ts", "message", ["room_id", "timestamp"])
    op.create_index("ix_message_receiver_ts", "message", ["receiver_id", "timestamp"])
    op.create_index("ix_message_expires", "message", ["expires_at"])

    # link_preview
    op.create_table(
        "link_preview",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("message_id", sa.Integer(), sa.ForeignKey("message.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("site_name", sa.String(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("link_preview")
    op.drop_index("ix_message_expires", table_name="message")
    op.drop_index("ix_message_receiver_ts", table_name="message")
    op.drop_index("ix_message_room_ts", table_name="message")
    op.drop_index("ix_message_sender_ts", table_name="message")
    op.drop_column("message", "is_silent")
    op.drop_column("message", "expires_at")
    op.drop_column("message", "edited_at")
    op.drop_column("message", "forwarded_from")
    op.drop_column("message", "reply_to_id")
