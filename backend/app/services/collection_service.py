import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ForbiddenError
from app.models.collection import Collection
from app.models.user import User
from app.repositories.collection_repo import CollectionRepository
from app.schemas.collection import CollectionCreate, CollectionUpdate
from app.vector_store.qdrant_client import ensure_collection


def _make_qdrant_name(name: str, owner_id: uuid.UUID) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:40]
    return f"{slug}_{str(owner_id)[:8]}"


class CollectionService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = CollectionRepository(session)

    async def create(self, data: CollectionCreate, owner: User) -> Collection:
        qdrant_name = _make_qdrant_name(data.name, owner.id)
        # Ensure uniqueness in case of slug collision
        existing = await self.repo.get_by_qdrant_name(qdrant_name)
        if existing:
            qdrant_name = f"{qdrant_name}_{str(uuid.uuid4())[:4]}"

        collection = await self.repo.create(
            name=data.name,
            description=data.description,
            owner_id=owner.id,
            qdrant_collection_name=qdrant_name,
        )
        # Create Qdrant collection eagerly
        ensure_collection(qdrant_name)
        return collection

    async def list_for_user(self, user: User) -> list[Collection]:
        return await self.repo.get_by_owner(user.id)

    async def get(self, collection_id: uuid.UUID, user: User) -> Collection:
        collection = await self.repo.get(collection_id)
        if not collection:
            raise NotFoundError("Collection not found")
        if collection.owner_id != user.id:
            raise ForbiddenError()
        return collection

    async def update(
        self, collection_id: uuid.UUID, data: CollectionUpdate, user: User
    ) -> Collection:
        collection = await self.get(collection_id, user)
        kwargs = data.model_dump(exclude_none=True)
        if not kwargs:
            return collection
        return await self.repo.update(collection, **kwargs)

    async def delete(self, collection_id: uuid.UUID, user: User) -> None:
        collection = await self.get(collection_id, user)
        await self.repo.delete(collection)
