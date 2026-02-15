"""Add username and bio to user table

Revision ID: 006_username_bio
Revises: b7c4e2a9f310
Create Date: 2026-02-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "006_username_bio"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user", sa.Column("username", sa.String(), nullable=True))
    op.add_column("user", sa.Column("bio", sa.String(), nullable=True))
    op.create_index(op.f("ix_user_username"), "user", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_username"), table_name="user")
    op.drop_column("user", "bio")
    op.drop_column("user", "username")
