import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CollectionRole(str, PyEnum):
    owner = "owner"
    editor = "editor"
    viewer = "viewer"


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    qdrant_collection_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
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
    owner: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="collections", foreign_keys=[owner_id]
    )
    roles: Mapped[list["RoleInCollection"]] = relationship(
        "RoleInCollection", back_populates="collection", cascade="all, delete-orphan"
    )
    access_policy: Mapped["AccessPolicy | None"] = relationship(
        "AccessPolicy", back_populates="collection", uselist=False, cascade="all, delete-orphan"
    )
    document_files: Mapped[list["DocumentFile"]] = relationship(  # noqa: F821
        "DocumentFile", back_populates="collection", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document", back_populates="collection", cascade="all, delete-orphan"
    )
    dialogs: Mapped[list["Dialog"]] = relationship(  # noqa: F821
        "Dialog", back_populates="collection", cascade="all, delete-orphan"
    )


class RoleInCollection(Base):
    __tablename__ = "roles_in_collections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[CollectionRole] = mapped_column(
        Enum(CollectionRole, name="collection_role"), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="roles")  # noqa: F821
    collection: Mapped["Collection"] = relationship("Collection", back_populates="roles")


class AccessPolicy(Base):
    __tablename__ = "access_policies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collections.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allow_anonymous_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    collection: Mapped["Collection"] = relationship("Collection", back_populates="access_policy")
