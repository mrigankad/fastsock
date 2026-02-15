"""add presence_status, pinned_message, bookmarked_message

Revision ID: 005
Revises: 004
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004_user_profile'

def upgrade():
    # Add presence_status to user table
    op.add_column('user', sa.Column('presence_status', sa.String(), server_default='available'))

    # Create pinned_message table
    op.create_table(
        'pinned_message',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('message_id', sa.Integer(), sa.ForeignKey('message.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('pinned_by', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('scope', sa.String(), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('message_id', 'scope', name='uq_pinned_message_scope'),
    )

    # Create bookmarked_message table
    op.create_table(
        'bookmarked_message',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('message_id', sa.Integer(), sa.ForeignKey('message.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False, index=True),
        sa.Column('note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('message_id', 'user_id', name='uq_bookmark_user_message'),
    )


def downgrade():
    op.drop_table('bookmarked_message')
    op.drop_table('pinned_message')
    op.drop_column('user', 'presence_status')
