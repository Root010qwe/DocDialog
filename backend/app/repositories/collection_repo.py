import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collection import Collection
from app.repositories.base import BaseRepository


class CollectionRepository(BaseRepository[Collection]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Collection, session)

    async def get_by_owner(self, owner_id: uuid.UUID) -> list[Collection]:
        result = await self.session.execute(
            select(Collection)
            .where(Collection.owner_id == owner_id)
            .order_by(Collection.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_qdrant_name(self, qdrant_name: str) -> Collection | None:
        result = await self.session.execute(
            select(Collection).where(Collection.qdrant_collection_name == qdrant_name)
        )
        return result.scalar_one_or_none()
