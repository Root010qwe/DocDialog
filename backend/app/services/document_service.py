import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import NotFoundError, ForbiddenError
from app.models.document import DocumentStatus
from app.models.user import User
from app.repositories.document_repo import DocumentFileRepository, DocumentRepository
from app.services.collection_service import CollectionService


class DocumentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.file_repo = DocumentFileRepository(session)
        self.doc_repo = DocumentRepository(session)

    async def upload(
        self,
        collection_id: uuid.UUID,
        file: UploadFile,
        user: User,
        description: str | None = None,
        tags: list[str] | None = None,
    ) -> tuple:
        col_service = CollectionService(self.session)
        collection = await col_service.get(collection_id, user)
        await col_service.require_editor_or_above(collection, user)

        file_id = uuid.uuid4()
        upload_dir = Path(settings.STORAGE_PATH) / "uploads" / str(collection_id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        suffix = Path(file.filename or "file").suffix
        file_path = upload_dir / f"{file_id}{suffix}"

        content = await file.read()
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        content_type = file.content_type or "application/octet-stream"

        doc_file = await self.file_repo.create(
            collection_id=collection_id,
            original_filename=file.filename or "unknown",
            file_path=str(file_path),
            content_type=content_type,
            file_size_bytes=len(content),
            uploaded_by=user.id,
        )

        document = await self.doc_repo.create(
            document_file_id=doc_file.id,
            collection_id=collection_id,
            title=Path(file.filename or "unknown").stem,
            description=description,
            tags=tags,
            status=DocumentStatus.pending,
        )

        return doc_file, document

    async def list_documents(
        self, collection_id: uuid.UUID, user: User
    ):
        col_service = CollectionService(self.session)
        await col_service.get(collection_id, user)
        return await self.doc_repo.get_by_collection(collection_id)

    async def get_document(self, document_id: uuid.UUID, user: User):
        doc = await self.doc_repo.get(document_id)
        if not doc:
            raise NotFoundError("Document not found")
        col_service = CollectionService(self.session)
        await col_service.get(doc.collection_id, user)
        return doc

    async def move_document(
        self,
        document_id: uuid.UUID,
        target_collection_id: uuid.UUID,
        user: User,
    ) -> None:
        """Move a document to another collection and re-trigger indexing."""
        doc = await self.doc_repo.get_with_chunks(document_id)
        if not doc:
            raise NotFoundError("Document not found")

        col_service = CollectionService(self.session)
        source_collection = await col_service.get(doc.collection_id, user)
        await col_service.require_editor_or_above(source_collection, user)
        target_collection = await col_service.get(target_collection_id, user)
        await col_service.require_editor_or_above(target_collection, user)

        if source_collection.id == target_collection.id:
            return  # no-op

        from app.vector_store.qdrant_client import delete_points_by_document
        delete_points_by_document(source_collection.qdrant_collection_name, str(document_id))

        for chunk in doc.chunks:
            await self.session.delete(chunk)
        await self.session.flush()

        doc_file = await self.file_repo.get(doc.document_file_id)
        if doc_file:
            doc_file.collection_id = target_collection_id
            self.session.add(doc_file)

        doc.collection_id = target_collection_id
        doc.status = DocumentStatus.pending
        doc.chunk_count = 0
        doc.indexing_progress = 0
        doc.indexed_at = None
        doc.error_message = None
        self.session.add(doc)
        await self.session.commit()

    async def delete_document(self, document_id: uuid.UUID, user: User) -> None:
        doc = await self.doc_repo.get_with_chunks(document_id)
        if not doc:
            raise NotFoundError("Document not found")

        col_service = CollectionService(self.session)
        collection = await col_service.get(doc.collection_id, user)
        await col_service.require_editor_or_above(collection, user)

        from app.vector_store.qdrant_client import delete_points_by_document
        delete_points_by_document(collection.qdrant_collection_name, str(document_id))

        doc_file = await self.file_repo.get(doc.document_file_id)
        if doc_file and os.path.exists(doc_file.file_path):
            os.remove(doc_file.file_path)

        await self.doc_repo.delete(doc)
