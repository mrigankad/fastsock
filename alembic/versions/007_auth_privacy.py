"""Auth, privacy and social tables

Revision ID: 007_auth_privacy
Revises: 006_username_bio
Create Date: 2026-02-14

Adds:
  - user.last_seen_at
  - user.email_verified
  - user_block (blocking)
  - user_contact (contacts/friends)
  - user_session (active sessions)
  - user_privacy (per-user privacy settings)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007_auth_privacy"
down_revision: Union[str, None] = "006_username_bio"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New columns on user
    op.add_column("user", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))

    # user_block
    op.create_table(
        "user_block",
        sa.Column("blocker_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("blocked_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("blocker_id", "blocked_id"),
    )

    # user_contact
    op.create_table(
        "user_contact",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("user_id", "contact_id"),
    )

    # user_session
    op.create_table(
        "user_session",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_active_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_session_user_id", "user_session", ["user_id"])

    # user_privacy
    op.create_table(
        "user_privacy",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("show_last_seen", sa.String(), nullable=False, server_default="everyone"),
        sa.Column("show_avatar", sa.String(), nullable=False, server_default="everyone"),
        sa.Column("show_bio", sa.String(), nullable=False, server_default="everyone"),
        sa.Column("allow_dms", sa.String(), nullable=False, server_default="everyone"),
        sa.Column("show_read_receipts", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_table("user_privacy")
    op.drop_index("ix_user_session_user_id", table_name="user_session")
    op.drop_table("user_session")
    op.drop_table("user_contact")
    op.drop_table("user_block")
    op.drop_column("user", "email_verified")
    op.drop_column("user", "last_seen_at")
