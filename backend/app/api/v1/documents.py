import uuid
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, status, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.document import DocumentRead, DocumentUploadResponse
from app.services.document_service import DocumentService


class MoveDocumentRequest(BaseModel):
    target_collection_id: uuid.UUID

router = APIRouter(prefix="/collections/{collection_id}/documents", tags=["documents"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/markdown",
    "text/html",
    "application/xhtml+xml",
}

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".markdown", ".html", ".htm"}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    collection_id: uuid.UUID,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # comma-separated
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from pathlib import Path

    ext = Path(file.filename or "").suffix.lower()
    if file.content_type not in ALLOWED_CONTENT_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )

    tags_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None

    content_preview = await file.read()
    if len(content_preview) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Файл слишком большой. Максимум: {MAX_FILE_SIZE // 1024 // 1024}MB",
        )
    await file.seek(0)

    service = DocumentService(session)
    doc_file, document = await service.upload(
        collection_id, file, current_user, description=description, tags=tags_list
    )

    from app.tasks.indexing_tasks import index_document
    index_document.delay(str(doc_file.id))

    return DocumentUploadResponse(
        document_file_id=doc_file.id,
        document_id=document.id,
        status=document.status,
    )


@router.get("", response_model=list[DocumentRead])
async def list_documents(
    collection_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DocumentService(session)
    return await service.list_documents(collection_id, current_user)


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DocumentService(session)
    return await service.get_document(document_id, current_user)


@router.patch("/{document_id}/move", status_code=status.HTTP_204_NO_CONTENT)
async def move_document(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    data: MoveDocumentRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.core.exceptions import NotFoundError, ForbiddenError
    service = DocumentService(session)
    try:
        await service.move_document(document_id, data.target_collection_id, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ForbiddenError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    from app.services.document_service import DocumentService as DS
    doc_service = DS(session)
    doc = await doc_service.get_document(document_id, current_user)
    from app.tasks.indexing_tasks import index_document
    index_document.delay(str(doc.document_file_id))


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DocumentService(session)
    await service.delete_document(document_id, current_user)


@router.get("/{document_id}/summary")
async def summarize_document(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.summary_service import SummaryService
    from app.core.exceptions import NotFoundError, ForbiddenError
    import json

    doc_service = DocumentService(session)
    try:
        document = await doc_service.get_document(document_id, current_user)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    except ForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if document.collection_id != collection_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in this collection")

    summary_service = SummaryService(session)

    async def generate():
        try:
            async for chunk in summary_service.summarize_document_streaming(document_id):
                yield f'data: {json.dumps({"chunk": chunk})}\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"error": str(e)})}\n\n'

    return StreamingResponse(generate(), media_type="text/event-stream")
