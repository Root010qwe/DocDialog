import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field


class Citation(BaseModel):
    chunk_id: uuid.UUID
    document_title: str
    chunk_text: str
    similarity_score: float
    rerank_score: Optional[float] = None


class DialogCreate(BaseModel):
    collection_id: uuid.UUID


class DialogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    collection_id: uuid.UUID
    user_id: uuid.UUID
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DialogMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4096)


class MessageRatingUpdate(BaseModel):
    rating: Optional[Literal["positive", "negative"]] = None


class DialogMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dialog_id: uuid.UUID
    role: str  # "user" | "assistant"
    content: str
    created_at: datetime
    rating: Optional[str] = None
    citations: list[Citation] = []
