import uuid
import json
import logging
from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.dialog import DialogMessage, MessageRole
from app.models.document import Document, DocumentFile
from app.schemas.dialog import DialogCreate, DialogRead, DialogMessageCreate, DialogMessageRead, Citation, MessageRatingUpdate
from app.services.dialog_service import DialogService
from app.services.rag_service import RAGService
from app.services.export_service import ExportService
from app.repositories.dialog_repo import RelevantQueryFragmentRepository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dialogs", tags=["dialogs"])


@router.post("", response_model=DialogRead, status_code=status.HTTP_201_CREATED)
async def create_dialog(
    data: DialogCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.collection_service import CollectionService
    col_service = CollectionService(session)
    await col_service.get(data.collection_id, current_user)

    service = DialogService(session)
    return await service.create_dialog(data.collection_id, current_user.id)


@router.get("", response_model=list[DialogRead])
async def list_dialogs(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DialogService(session)
    return await service.list_dialogs_for_user(current_user.id)


@router.get("/{dialog_id}", response_model=DialogRead)
async def get_dialog(
    dialog_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DialogService(session)
    dialog = await service.get_dialog(dialog_id, current_user.id)
    if not dialog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")
    return dialog


@router.post("/{dialog_id}/messages")
async def send_message(
    dialog_id: uuid.UUID,
    data: DialogMessageCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dialog_service = DialogService(session)

    # Verify dialog belongs to user
    dialog = await dialog_service.get_dialog(dialog_id, current_user.id)
    if not dialog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")

    history = await dialog_service.get_message_history(dialog_id, limit=6)
    is_first_message = len(history) == 0 and not dialog.title

    user_message = await dialog_service.add_message(dialog_id, data.content, MessageRole.user)
    logger.info("User message created: %s", user_message.id)

    rag_service = RAGService(session)

    query_vector = await rag_service.embed_query(data.content)

    chunks = await rag_service.search_relevant_chunks(
        query_vector=query_vector,
        collection_id=dialog.collection_id,
        top_k=40,
    )
    logger.info("Found %d chunks", len(chunks))

    reranked_chunks = await rag_service.rerank_chunks(
        chunks=chunks,
        query=data.content,
        top_k=5,
    )
    logger.info("Reranked to %d chunks", len(reranked_chunks))

    # Drop context only when reranker signals complete garbage (very conservative threshold).
    RERANK_THRESHOLD = -10.0
    if reranked_chunks:
        best_score = max(getattr(c, "rerank_score", 0) or 0 for c in reranked_chunks)
        if best_score < RERANK_THRESHOLD:
            logger.warning("All chunks below threshold (best=%.2f), clearing context", best_score)
            reranked_chunks = []
        elif best_score < -3.0:
            logger.info("Low rerank scores (best=%.2f) — context kept, LLM will qualify", best_score)

    # Re-sort by similarity_score (cosine from multilingual-e5-large) for display ordering.
    # The cross-encoder reranker handles chunk selection (top_k filter) but mixes up display
    # order on Russian text when rerank scores are close. Cosine similarity is more reliable
    # for Russian semantic ranking.
    if reranked_chunks:
        reranked_chunks.sort(
            key=lambda c: getattr(c, "similarity_score", 0) or 0,
            reverse=True,
        )

    doc_ids = [c.document_id for c in reranked_chunks]
    doc_names: dict[uuid.UUID, str] = {}
    if doc_ids:
        doc_result = await session.execute(
            select(Document, DocumentFile)
            .join(DocumentFile, Document.document_file_id == DocumentFile.id)
            .where(Document.id.in_(doc_ids))
        )
        for doc, doc_file in doc_result.all():
            doc_names[doc.id] = doc_file.original_filename

    for chunk in reranked_chunks:
        chunk._doc_title = doc_names.get(chunk.document_id, "документ")

    citation_dicts = [
        {
            "chunk_id": str(chunk.id),
            "document_title": doc_names.get(chunk.document_id, "Unknown"),
            "chunk_text": chunk.text[:500],
            "similarity_score": getattr(chunk, "similarity_score", 0.0),
            "rerank_score": getattr(chunk, "rerank_score", None),
        }
        for chunk in reranked_chunks
    ]

    assistant_message = await dialog_service.add_message(
        dialog_id, "", MessageRole.assistant
    )

    await dialog_service.store_citations(
        message_id=assistant_message.id,
        chunks=reranked_chunks,
    )
    logger.info("Citations stored for message: %s", assistant_message.id)

    async def generate_events():
        full_response = ""
        try:
            async for text_chunk in rag_service.generate_streaming_response(
                chunks=reranked_chunks,
                query=data.content,
                history=history,
            ):
                full_response += text_chunk
                yield f'data: {json.dumps({"chunk": text_chunk})}\n\n'

            # Re-sort citations by word overlap with the actual LLM answer.
            # The reranker and embedder both over-weight lexical query match over answer content;
            # sorting by overlap with the generated answer surfaces the chunk that was actually used.
            if full_response:
                import re as _re
                answer_words = set(_re.findall(r'\w{3,}', full_response.lower()))
                def _overlap(c: dict) -> float:
                    words = _re.findall(r'\w{3,}', c.get("chunk_text", "").lower())
                    if not words:
                        return 0.0
                    return sum(1 for w in words if w in answer_words) / len(words)
                citation_dicts.sort(key=_overlap, reverse=True)

            yield f'data: {json.dumps({"citations": citation_dicts})}\n\n'

            # Auto-generate dialog title on first message
            if is_first_message:
                try:
                    title = await rag_service.generate_dialog_title(data.content)
                    await dialog_service.update_dialog_title(dialog_id, title)
                    yield f'data: {json.dumps({"dialog_title": title})}\n\n'
                    logger.info("Auto-title generated for dialog %s: %s", dialog_id, title)
                except Exception as title_err:
                    logger.warning("Auto-title failed: %s", title_err)

        except Exception as e:
            logger.exception("SSE stream error: %s", e)
            yield f'data: {json.dumps({"error": str(e)})}\n\n'
        finally:
            try:
                assistant_message.content = full_response
                session.add(assistant_message)
                await session.commit()
            except Exception as commit_err:
                logger.warning("Session commit failed after stream: %s", commit_err)
                try:
                    await session.rollback()
                except Exception:
                    pass

    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream",
    )


@router.get("/{dialog_id}/messages", response_model=list[DialogMessageRead])
async def list_messages(
    dialog_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DialogService(session)
    dialog = await service.get_dialog(dialog_id, current_user.id)
    if not dialog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")

    messages = await service.get_messages_with_citations(dialog_id)
    return messages


@router.patch("/{dialog_id}/messages/{message_id}/rating", response_model=DialogMessageRead)
async def rate_message(
    dialog_id: uuid.UUID,
    message_id: uuid.UUID,
    data: MessageRatingUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dialog_service = DialogService(session)
    dialog = await dialog_service.get_dialog(dialog_id, current_user.id)
    if not dialog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")

    from sqlalchemy import select
    result = await session.execute(
        select(DialogMessage).where(
            DialogMessage.id == message_id,
            DialogMessage.dialog_id == dialog_id,
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message.role != MessageRole.assistant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only assistant messages can be rated",
        )

    from app.models.dialog import MessageRating
    message.rating = MessageRating(data.rating) if data.rating else None
    session.add(message)
    await session.commit()
    await session.refresh(message)

    msg_read = DialogMessageRead.model_validate(message)
    msg_read.citations = []
    return msg_read


@router.get("/{dialog_id}/export/pdf")
async def export_dialog_pdf(
    dialog_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    export_service = ExportService(session)
    pdf_bytes = await export_service.export_dialog_pdf(dialog_id, current_user.id)
    if not pdf_bytes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="dialog_{dialog_id}.pdf"'},
    )


@router.get("/{dialog_id}/export/docx")
async def export_dialog_docx(
    dialog_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    export_service = ExportService(session)
    docx_bytes = await export_service.export_dialog_docx(dialog_id, current_user.id)
    if not docx_bytes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialog not found")
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="dialog_{dialog_id}.docx"'},
    )
