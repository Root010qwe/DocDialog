import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.collection import Collection
from app.models.document import Document, DocumentStatus
from app.models.user import User
from app.schemas.collection import CollectionCreate, CollectionUpdate, CollectionRead
from app.services.collection_service import CollectionService
from app.services.summary_service import SummaryService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/collections", tags=["collections"])

# Progress message prefixes — everything else is final LLM content
_PROGRESS_PREFIXES = (
    "Анализирую", "Группа", "Формирую", "Не удалось", "Коллекция не",
)


async def _count_indexed_docs(session: AsyncSession, collection_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count()).select_from(Document).where(
            Document.collection_id == collection_id,
            Document.status == DocumentStatus.indexed,
        )
    )
    return result.scalar() or 0


async def _with_role(collection: Collection, service: CollectionService, user: User) -> CollectionRead:
    col_read = CollectionRead.model_validate(collection)
    col_read.user_role = await service.get_user_role(collection, user)
    return col_read


@router.post("", response_model=CollectionRead, status_code=status.HTTP_201_CREATED)
async def create_collection(
    data: CollectionCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    col = await service.create(data, current_user)
    return await _with_role(col, service, current_user)


@router.get("", response_model=list[CollectionRead])
async def list_collections(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    cols = await service.list_for_user(current_user)
    return [await _with_role(c, service, current_user) for c in cols]


@router.get("/{collection_id}", response_model=CollectionRead)
async def get_collection(
    collection_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    col = await service.get(collection_id, current_user)
    return await _with_role(col, service, current_user)


@router.patch("/{collection_id}", response_model=CollectionRead)
async def update_collection(
    collection_id: uuid.UUID,
    data: CollectionUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    col = await service.update(collection_id, data, current_user)
    return await _with_role(col, service, current_user)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    await service.delete(collection_id, current_user)


class SummaryCacheResponse(BaseModel):
    text: str | None
    doc_count: int | None
    current_doc_count: int
    generated_at: datetime | None
    is_valid: bool


@router.get("/{collection_id}/summary/cached", response_model=SummaryCacheResponse)
async def get_summary_cached(
    collection_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    coll_service = CollectionService(session)
    collection = await coll_service.get(collection_id, current_user)
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    current_doc_count = await _count_indexed_docs(session, collection_id)

    is_valid = (
        collection.summary_text is not None
        and collection.summary_doc_count is not None
        and collection.summary_doc_count == current_doc_count
        and current_doc_count > 0
    )

    return SummaryCacheResponse(
        text=collection.summary_text if is_valid else None,
        doc_count=collection.summary_doc_count,
        current_doc_count=current_doc_count,
        generated_at=collection.summary_generated_at,
        is_valid=is_valid,
    )


@router.get("/{collection_id}/summary")
async def summarize_collection(
    collection_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    coll_service = CollectionService(session)
    collection = await coll_service.get(collection_id, current_user)
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    current_doc_count = await _count_indexed_docs(session, collection_id)
    summary_service = SummaryService(session)

    async def generate():
        final_chunks: list[str] = []
        try:
            async for chunk in summary_service.summarize_collection_streaming(collection_id):
                is_progress = chunk.startswith(_PROGRESS_PREFIXES)
                if not is_progress and chunk.strip():
                    final_chunks.append(chunk)
                yield f'data: {json.dumps({"chunk": chunk})}\n\n'
        except Exception as e:
            logger.exception("Summary stream error: %s", e)
            yield f'data: {json.dumps({"error": str(e)})}\n\n'

        # Persist cache after streaming completes
        if final_chunks:
            try:
                result = await session.execute(
                    select(Collection).where(Collection.id == collection_id)
                )
                coll = result.scalar_one_or_none()
                if coll:
                    coll.summary_text = "".join(final_chunks)
                    coll.summary_doc_count = current_doc_count
                    coll.summary_generated_at = datetime.now(timezone.utc)
                    session.add(coll)
                    await session.commit()
                    logger.info("Summary cached for collection %s (%d docs)", collection_id, current_doc_count)
            except Exception as cache_err:
                logger.warning("Failed to save summary cache: %s", cache_err)

    return StreamingResponse(generate(), media_type="text/event-stream")
