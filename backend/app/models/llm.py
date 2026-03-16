import uuid

from sqlalchemy import String, Float, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LLM(Base):
    __tablename__ = "llms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # "ollama" | "openai"
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, default=2048, nullable=False)
    temperature: Mapped[float] = mapped_column(Float, default=0.1, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    dialogs: Mapped[list["Dialog"]] = relationship(  # noqa: F821
        "Dialog", back_populates="llm"
    )
