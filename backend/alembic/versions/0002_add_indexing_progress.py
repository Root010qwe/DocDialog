"""add indexing_progress to documents

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: str = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("indexing_progress", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("documents", "indexing_progress")
