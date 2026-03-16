import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Enum, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MessageRole(str, PyEnum):
    user = "user"
    assistant = "assistant"
    system = "system"


class Dialog(Base):
    __tablename__ = "dialogs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    llm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("llms.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    collection: Mapped["Collection"] = relationship(  # noqa: F821
        "Collection", back_populates="dialogs"
    )
    user: Mapped["User"] = relationship("User", back_populates="dialogs")  # noqa: F821
    llm: Mapped["LLM | None"] = relationship("LLM", back_populates="dialogs")  # noqa: F821
    messages: Mapped[list["DialogMessage"]] = relationship(
        "DialogMessage", back_populates="dialog", cascade="all, delete-orphan",
        order_by="DialogMessage.created_at"
    )
    statistics: Mapped["DialogStatistics | None"] = relationship(
        "DialogStatistics", back_populates="dialog", uselist=False, cascade="all, delete-orphan"
    )


class DialogMessage(Base):
    __tablename__ = "dialog_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dialog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dialogs.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    dialog: Mapped["Dialog"] = relationship("Dialog", back_populates="messages")
    relevant_fragments: Mapped[list["RelevantQueryFragment"]] = relationship(  # noqa: F821
        "RelevantQueryFragment", back_populates="dialog_message", cascade="all, delete-orphan"
    )


class DialogStatistics(Base):
    __tablename__ = "dialog_statistics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dialog_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dialogs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    total_messages: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_response_time_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    dialog: Mapped["Dialog"] = relationship("Dialog", back_populates="statistics")
