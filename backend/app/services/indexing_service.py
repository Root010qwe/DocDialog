import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import DocumentStatus

logger = logging.getLogger(__name__)


class IndexingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def index_document(self, document_file_id: str) -> None:
        from app.repositories.document_repo import DocumentFileRepository, DocumentRepository, DocumentChunkRepository
        from app.repositories.collection_repo import CollectionRepository
        from app.parsers.base import ParserFactory
        import app.parsers.registry  # noqa: F401 — registers all parsers
        from app.chunkers.recursive_chunker import RecursiveChunker
        from app.embeddings.embedder import get_embedder
        from app.vector_store.qdrant_client import upsert_points, ensure_collection

        file_repo = DocumentFileRepository(self.session)
        doc_repo = DocumentRepository(self.session)
        chunk_repo = DocumentChunkRepository(self.session)
        col_repo = CollectionRepository(self.session)

        file_id = uuid.UUID(document_file_id)

        # 1. Load records
        doc_file = await file_repo.get(file_id)
        if not doc_file:
            logger.error("DocumentFile not found: %s", document_file_id)
            return

        document = await doc_repo.get_by_file_id(file_id)
        if not document:
            logger.error("Document not found for file: %s", document_file_id)
            return

        collection = await col_repo.get(doc_file.collection_id)
        if not collection:
            logger.error("Collection not found: %s", doc_file.collection_id)
            return

        # 2. Mark as indexing
        await doc_repo.update(document, status=DocumentStatus.indexing)
        await self.session.commit()

        try:
            # 3. Parse
            parser = ParserFactory.get(doc_file.content_type, doc_file.original_filename)
            parsed = parser.parse(doc_file.file_path, doc_file.original_filename)

            if not parsed.text.strip():
                raise ValueError("Parser returned empty text")

            # Update title if parser extracted a better one
            if parsed.title:
                await doc_repo.update(document, title=parsed.title)

            # 4. Chunk
            chunker = RecursiveChunker()
            chunks = chunker.chunk(parsed.text)
            logger.info("Document %s split into %d chunks", document.id, len(chunks))

            if not chunks:
                raise ValueError("No chunks produced")

            # 5. Embed (batch)
            embedder = get_embedder()
            texts = [c.text for c in chunks]
            vectors = embedder.encode_passages(texts, batch_size=32)

            # 6. Ensure Qdrant collection exists
            ensure_collection(collection.qdrant_collection_name)

            # 7. Build Qdrant points + DB records
            qdrant_points = []
            db_chunk_records = []

            for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
                point_id = uuid.uuid4()
                qdrant_points.append({
                    "id": point_id,
                    "vector": vector,
                    "payload": {
                        "document_id": str(document.id),
                        "collection_id": str(collection.id),
                        "chunk_index": chunk.chunk_index,
                        "text": chunk.text,
                        "title": parsed.title,
                    },
                })
                db_chunk_records.append({
                    "id": uuid.uuid4(),
                    "document_id": document.id,
                    "chunk_index": chunk.chunk_index,
                    "text": chunk.text,
                    "token_count": chunk.token_count,
                    "qdrant_point_id": point_id,
                })

            # 8. Upsert to Qdrant in batches of 100
            batch_size = 100
            for start in range(0, len(qdrant_points), batch_size):
                upsert_points(
                    collection.qdrant_collection_name,
                    qdrant_points[start:start + batch_size],
                )

            # 9. Save chunks to DB
            await chunk_repo.bulk_create(db_chunk_records)

            # 10. Mark as indexed
            await doc_repo.update(
                document,
                status=DocumentStatus.indexed,
                chunk_count=len(chunks),
                indexed_at=datetime.now(timezone.utc),
            )
            await self.session.commit()
            logger.info("Indexed document %s: %d chunks", document.id, len(chunks))

        except Exception as exc:
            logger.error("Indexing failed for document %s: %s", document.id, exc, exc_info=True)
            await doc_repo.update(
                document,
                status=DocumentStatus.error,
                error_message=str(exc)[:1000],
            )
            await self.session.commit()
            raise
