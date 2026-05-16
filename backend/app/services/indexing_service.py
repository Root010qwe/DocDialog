import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import DocumentStatus

logger = logging.getLogger(__name__)

# Progress checkpoints (%)
_P_START = 0
_P_PARSED = 15
_P_CHUNKED = 25
_P_EMBED_START = 25
_P_EMBED_END = 82
_P_QDRANT = 92
_P_DB = 97
_P_DONE = 100


class IndexingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _set_progress(self, doc_repo, document, pct: int) -> None:
        await doc_repo.update(document, indexing_progress=pct)
        await self.session.commit()

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

        await doc_repo.update(document, status=DocumentStatus.indexing, indexing_progress=_P_START)
        await self.session.commit()

        try:
            parser = ParserFactory.get(doc_file.content_type, doc_file.original_filename)
            parsed = parser.parse(doc_file.file_path, doc_file.original_filename)

            if not parsed.text.strip():
                raise ValueError("Parser returned empty text")

            if parsed.title:
                await doc_repo.update(document, title=parsed.title)

            await self._set_progress(doc_repo, document, _P_PARSED)

            # Speaker-labelled transcripts use a turn-aware chunker to keep Q&A pairs together.
            from app.chunkers.transcript_chunker import TranscriptChunker, is_transcript
            if is_transcript(parsed.text):
                logger.info("Transcript format detected — using TranscriptChunker")
                chunker = TranscriptChunker(turns_per_chunk=3, overlap_turns=1)
            else:
                chunker = RecursiveChunker(chunk_size=512, chunk_overlap=64)
            chunks = chunker.chunk(parsed.text)
            logger.info("Document %s split into %d chunks", document.id, len(chunks))

            if not chunks:
                raise ValueError("No chunks produced")

            await self._set_progress(doc_repo, document, _P_CHUNKED)

            embedder = get_embedder()
            texts = [c.text for c in chunks]
            embed_batch = 32
            all_vectors: list = []

            for batch_start in range(0, len(texts), embed_batch):
                batch = texts[batch_start: batch_start + embed_batch]
                vecs = embedder.encode_passages(batch, batch_size=embed_batch)
                all_vectors.extend(vecs)

                done_ratio = min((batch_start + len(batch)) / len(texts), 1.0)
                pct = _P_EMBED_START + int((_P_EMBED_END - _P_EMBED_START) * done_ratio)
                await self._set_progress(doc_repo, document, pct)

            vectors = all_vectors

            ensure_collection(collection.qdrant_collection_name)

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

            # DB insert before Qdrant upsert: Qdrant point_ids must reference existing chunks.
            await chunk_repo.bulk_create(db_chunk_records)
            await self._set_progress(doc_repo, document, _P_DB)

            batch_size = 100
            for start in range(0, len(qdrant_points), batch_size):
                upsert_points(
                    collection.qdrant_collection_name,
                    qdrant_points[start: start + batch_size],
                )

            await self._set_progress(doc_repo, document, _P_QDRANT)

            await doc_repo.update(
                document,
                status=DocumentStatus.indexed,
                indexing_progress=_P_DONE,
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
