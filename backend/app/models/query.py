import uuid

from sqlalchemy import ForeignKey, Float, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RelevantQueryFragment(Base):
    """Links an assistant message to the document chunks that informed it."""
    __tablename__ = "relevant_query_fragments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dialog_message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dialog_messages.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="CASCADE"),
        nullable=False,
    )
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    rerank_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    rank_position: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    dialog_message: Mapped["DialogMessage"] = relationship(  # noqa: F821
        "DialogMessage", back_populates="relevant_fragments"
    )
    chunk: Mapped["DocumentChunk"] = relationship(  # noqa: F821
        "DocumentChunk", back_populates="relevant_fragments"
    )
