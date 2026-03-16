import uuid
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentFile, DocumentChunk, DocumentStatus
from app.repositories.base import BaseRepository


class DocumentFileRepository(BaseRepository[DocumentFile]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(DocumentFile, session)

    async def get_by_collection(self, collection_id: uuid.UUID) -> list[DocumentFile]:
        result = await self.session.execute(
            select(DocumentFile)
            .where(DocumentFile.collection_id == collection_id)
            .order_by(DocumentFile.uploaded_at.desc())
        )
        return list(result.scalars().all())


class DocumentRepository(BaseRepository[Document]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Document, session)

    async def get_by_collection(self, collection_id: uuid.UUID) -> list[Document]:
        result = await self.session.execute(
            select(Document)
            .where(Document.collection_id == collection_id)
            .order_by(Document.document_file_id)
        )
        return list(result.scalars().all())

    async def get_by_file_id(self, document_file_id: uuid.UUID) -> Document | None:
        result = await self.session.execute(
            select(Document).where(Document.document_file_id == document_file_id)
        )
        return result.scalar_one_or_none()

    async def get_with_chunks(self, document_id: uuid.UUID) -> Document | None:
        result = await self.session.execute(
            select(Document)
            .options(selectinload(Document.chunks))
            .where(Document.id == document_id)
        )
        return result.scalar_one_or_none()

    async def get_by_collection_status(
        self, collection_id: uuid.UUID, status: DocumentStatus
    ) -> list[Document]:
        result = await self.session.execute(
            select(Document).where(
                Document.collection_id == collection_id,
                Document.status == status,
            )
        )
        return list(result.scalars().all())


class DocumentChunkRepository(BaseRepository[DocumentChunk]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(DocumentChunk, session)

    async def get_by_ids(self, chunk_ids: list[uuid.UUID]) -> list[DocumentChunk]:
        result = await self.session.execute(
            select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids))
        )
        return list(result.scalars().all())

    async def bulk_create(self, chunks: list[dict]) -> None:
        from app.models.document import DocumentChunk as DC
        self.session.add_all([DC(**c) for c in chunks])
        await self.session.flush()
