import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    collections: Mapped[list["Collection"]] = relationship(  # noqa: F821
        "Collection", back_populates="owner", foreign_keys="Collection.owner_id"
    )
    roles: Mapped[list["RoleInCollection"]] = relationship(  # noqa: F821
        "RoleInCollection", back_populates="user"
    )
    dialogs: Mapped[list["Dialog"]] = relationship(  # noqa: F821
        "Dialog", back_populates="user"
    )
