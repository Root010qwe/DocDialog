import asyncio
import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="index_document", bind=True, max_retries=3)
def index_document(self, document_file_id: str) -> dict:
    """Celery task: parse, chunk, embed and upsert a document into Qdrant."""
    try:
        return asyncio.run(_index_document_async(document_file_id))
    except Exception as exc:
        logger.error("Indexing failed for document_file_id=%s: %s", document_file_id, exc)
        raise self.retry(exc=exc, countdown=60)


async def _index_document_async(document_file_id: str) -> dict:
    from app.db.session import AsyncSessionLocal
    from app.services.indexing_service import IndexingService

    async with AsyncSessionLocal() as session:
        service = IndexingService(session)
        await service.index_document(document_file_id)
    return {"status": "ok", "document_file_id": document_file_id}
