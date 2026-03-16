import uuid

from fastapi import APIRouter, Depends, UploadFile, File, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.document import DocumentRead, DocumentUploadResponse
from app.services.document_service import DocumentService

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

    service = DocumentService(session)
    doc_file, document = await service.upload(collection_id, file, current_user)

    # Enqueue Celery indexing task
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


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DocumentService(session)
    await service.delete_document(document_id, current_user)
