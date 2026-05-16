"""add description and tags to documents

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision: str = "0004"
down_revision: str = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("tags", ARRAY(sa.String()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("documents", "tags")
    op.drop_column("documents", "description")
