"""add user profile fields

Revision ID: 004_user_profile
Revises: 
Create Date: 2026-02-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_user_profile'
down_revision: Union[str, None] = 'b7c4e2a9f310'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user', sa.Column('display_name', sa.String(), nullable=True))
    op.add_column('user', sa.Column('avatar_url', sa.String(), nullable=True))
    op.add_column('user', sa.Column('status_message', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'status_message')
    op.drop_column('user', 'avatar_url')
    op.drop_column('user', 'display_name')
