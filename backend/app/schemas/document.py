import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

from app.models.document import DocumentStatus


class DocumentFileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    collection_id: uuid.UUID
    original_filename: str
    content_type: str
    file_size_bytes: int
    uploaded_at: datetime


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_file_id: uuid.UUID
    collection_id: uuid.UUID
    title: str
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    language: str | None
    status: DocumentStatus
    error_message: str | None
    chunk_count: int
    indexing_progress: int = 0
    indexed_at: datetime | None


class DocumentWithFileRead(DocumentRead):
    file: DocumentFileRead | None = None


class DocumentUploadResponse(BaseModel):
    document_file_id: uuid.UUID
    document_id: uuid.UUID
    status: DocumentStatus
    message: str = "Document upload accepted, indexing started"
