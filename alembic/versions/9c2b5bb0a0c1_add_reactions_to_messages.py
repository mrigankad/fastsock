"""Add reactions column to messages

Revision ID: 9c2b5bb0a0c1
Revises: 5d148ef19220
Create Date: 2026-02-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c2b5bb0a0c1"
down_revision: Union[str, None] = "adefca12d281"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("message", sa.Column("reactions", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))


def downgrade() -> None:
    op.drop_column("message", "reactions")

