import asyncio
import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="index_document", bind=True, max_retries=3)
def index_document(self, document_file_id: str) -> dict:
    try:
        return asyncio.run(_index_document_async(document_file_id))
    except Exception as exc:
        logger.error("Indexing failed for document_file_id=%s: %s", document_file_id, exc)
        raise self.retry(exc=exc, countdown=30)


async def _index_document_async(document_file_id: str) -> dict:
    # NullPool: no connection reuse between asyncio.run() calls.
    # Each Celery task gets its own fresh connections, avoiding the
    # "Future attached to a different loop" asyncpg error.
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy.pool import NullPool
    from app.config import settings
    from app.services.indexing_service import IndexingService

    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    try:
        session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
        async with session_factory() as session:
            service = IndexingService(session)
            await service.index_document(document_file_id)
    finally:
        await engine.dispose()

    return {"status": "ok", "document_file_id": document_file_id}
