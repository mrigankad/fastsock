"""add disappearing_timer table

Revision ID: 011_disappearing_messages
Revises: 010_audio_messages
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = '011_disappearing_messages'
down_revision = '010_audio_messages'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'disappearing_timer',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'target_type', 'target_id', name='uq_disappearing_target'),
    )
    op.create_index('idx_disappearing_user', 'disappearing_timer', ['user_id'])


def downgrade():
    op.drop_index('idx_disappearing_user', table_name='disappearing_timer')
    op.drop_table('disappearing_timer')
