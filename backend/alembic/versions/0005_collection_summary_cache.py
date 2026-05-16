"""add summary cache to collections

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: str = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("collections", sa.Column("summary_text", sa.Text(), nullable=True))
    op.add_column("collections", sa.Column("summary_doc_count", sa.Integer(), nullable=True))
    op.add_column("collections", sa.Column("summary_generated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("collections", "summary_generated_at")
    op.drop_column("collections", "summary_doc_count")
    op.drop_column("collections", "summary_text")
