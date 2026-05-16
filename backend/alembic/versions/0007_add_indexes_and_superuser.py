"""add performance indexes and is_superuser field

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: str = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_superuser column to users table
    op.add_column(
        "users",
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Index on document_chunks.document_id (FK lookup)
    op.create_index(
        "ix_document_chunks_document_id",
        "document_chunks",
        ["document_id"],
    )

    # Index on document_chunks.qdrant_point_id (CRITICAL for RAG search by point id)
    op.create_index(
        "ix_document_chunks_qdrant_point_id",
        "document_chunks",
        ["qdrant_point_id"],
    )

    # Index on dialogs.user_id (FK lookup)
    op.create_index(
        "ix_dialogs_user_id",
        "dialogs",
        ["user_id"],
    )

    # Index on dialog_messages.dialog_id (FK lookup)
    op.create_index(
        "ix_dialog_messages_dialog_id",
        "dialog_messages",
        ["dialog_id"],
    )

    # Index on relevant_query_fragments.dialog_message_id (FK lookup)
    op.create_index(
        "ix_relevant_query_fragments_dialog_message_id",
        "relevant_query_fragments",
        ["dialog_message_id"],
    )

    # Index on documents.collection_id (FK lookup)
    op.create_index(
        "ix_documents_collection_id",
        "documents",
        ["collection_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_documents_collection_id", table_name="documents")
    op.drop_index("ix_relevant_query_fragments_dialog_message_id", table_name="relevant_query_fragments")
    op.drop_index("ix_dialog_messages_dialog_id", table_name="dialog_messages")
    op.drop_index("ix_dialogs_user_id", table_name="dialogs")
    op.drop_index("ix_document_chunks_qdrant_point_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_column("users", "is_superuser")
