"""add rating to dialog_messages

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: str = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE message_rating AS ENUM ('positive', 'negative')")
    op.add_column(
        "dialog_messages",
        sa.Column(
            "rating",
            sa.Enum("positive", "negative", name="message_rating"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("dialog_messages", "rating")
    op.execute("DROP TYPE message_rating")
