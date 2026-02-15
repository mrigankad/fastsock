"""add audio message type

Revision ID: 010_audio_messages
Revises: 009_rooms_v2
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = '010_audio_messages'
down_revision = '009_rooms_v2'
branch_labels = None
depends_on = None


def upgrade():
    # SQLite stores enums as VARCHAR — just add the new value by updating
    # any existing CHECK constraint. In SQLite we recreate the table to
    # change a CHECK; however since SQLAlchemy-generated SQLite tables
    # typically don't have CHECK constraints on Enum columns (they are
    # stored as plain VARCHAR), this migration is a no-op for SQLite.
    # For PostgreSQL an ALTER TYPE … ADD VALUE would be needed.
    # The MessageType.AUDIO value will just work as a new string value.
    pass


def downgrade():
    pass
