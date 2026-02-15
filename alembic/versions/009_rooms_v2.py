"""Rooms v2 — roles, invite links, slow mode, notifications

Revision ID: 009_rooms_v2
Revises: 008_messaging_v2
Create Date: 2026-02-14

Adds to chatroom:
  - description, avatar_url, is_public, slow_mode_seconds

Adds to chatroom_member:
  - role (owner/admin/member), muted_until, notification_level

New tables:
  - room_invite_link
  - notification (in-app)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "009_rooms_v2"
down_revision: Union[str, None] = "008_messaging_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # chatroom enhancements
    op.add_column("chatroom", sa.Column("description", sa.String(), nullable=True))
    op.add_column("chatroom", sa.Column("avatar_url", sa.String(), nullable=True))
    op.add_column("chatroom", sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("chatroom", sa.Column("slow_mode_seconds", sa.Integer(), nullable=False, server_default="0"))

    # chatroom_member enhancements
    op.add_column("chatroom_member", sa.Column("role", sa.String(), nullable=False, server_default="member"))
    op.add_column("chatroom_member", sa.Column("muted_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("chatroom_member", sa.Column("notification_level", sa.String(), nullable=False, server_default="all"))

    # room_invite_link
    op.create_table(
        "room_invite_link",
        sa.Column("token", sa.String(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("chatroom.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_room_invite_link_room_id", "room_invite_link", ["room_id"])

    # in-app notification table
    op.create_table(
        "notification",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(), nullable=False),  # mention/dm/reaction/call
        sa.Column("message_id", sa.Integer(), sa.ForeignKey("message.id", ondelete="SET NULL"), nullable=True),
        sa.Column("from_user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notification_user_unread", "notification", ["user_id", "is_read"])


def downgrade() -> None:
    op.drop_index("ix_notification_user_unread", table_name="notification")
    op.drop_table("notification")
    op.drop_index("ix_room_invite_link_room_id", table_name="room_invite_link")
    op.drop_table("room_invite_link")
    op.drop_column("chatroom_member", "notification_level")
    op.drop_column("chatroom_member", "muted_until")
    op.drop_column("chatroom_member", "role")
    op.drop_column("chatroom", "slow_mode_seconds")
    op.drop_column("chatroom", "is_public")
    op.drop_column("chatroom", "avatar_url")
    op.drop_column("chatroom", "description")
