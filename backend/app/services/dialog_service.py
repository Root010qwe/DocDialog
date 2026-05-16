import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.dialog import Dialog, DialogMessage, MessageRole
from app.models.document import Document, DocumentFile, DocumentChunk
from app.models.query import RelevantQueryFragment
from app.repositories.dialog_repo import (
    DialogRepository,
    DialogMessageRepository,
    RelevantQueryFragmentRepository,
)

logger = logging.getLogger(__name__)


class DialogService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.dialog_repo = DialogRepository(session)
        self.message_repo = DialogMessageRepository(session)
        self.fragment_repo = RelevantQueryFragmentRepository(session)

    async def create_dialog(self, collection_id: uuid.UUID, user_id: uuid.UUID) -> Dialog:
        dialog = await self.dialog_repo.create(
            collection_id=collection_id,
            user_id=user_id,
        )
        logger.info("Dialog created: %s", dialog.id)
        return dialog

    async def get_dialog(self, dialog_id: uuid.UUID, user_id: uuid.UUID) -> Dialog | None:
        dialog = await self.dialog_repo.get(dialog_id)
        if dialog and dialog.user_id == user_id:
            return dialog
        return None

    async def list_dialogs_for_user(self, user_id: uuid.UUID) -> list[Dialog]:
        return await self.dialog_repo.list_for_user(user_id)

    async def add_message(
        self,
        dialog_id: uuid.UUID,
        content: str,
        role: MessageRole,
    ) -> DialogMessage:
        message = await self.message_repo.create(
            dialog_id=dialog_id,
            content=content,
            role=role,
        )
        logger.info("Message created: %s (role=%s)", message.id, role)
        return message

    async def get_message_history(
        self,
        dialog_id: uuid.UUID,
        limit: int = 10,
    ) -> list[DialogMessage]:
        messages = await self.message_repo.list_for_dialog(dialog_id)
        valid = [m for m in messages if m.content and m.content.strip()]
        return valid[-limit:]

    async def update_dialog_title(self, dialog_id: uuid.UUID, title: str) -> None:
        dialog = await self.dialog_repo.get(dialog_id)
        if dialog and not dialog.title:
            dialog.title = title
            self.session.add(dialog)
            await self.session.flush()

    async def store_citations(
        self,
        message_id: uuid.UUID,
        chunks: list[DocumentChunk],
    ) -> None:
        for rank, chunk in enumerate(chunks):
            await self.fragment_repo.create(
                dialog_message_id=message_id,
                chunk_id=chunk.id,
                similarity_score=chunk.similarity_score,
                rerank_score=getattr(chunk, "rerank_score", None),
                rank_position=rank,
            )
        logger.info("Stored %d citations for message %s", len(chunks), message_id)

    async def get_messages_with_citations(self, dialog_id: uuid.UUID) -> list[DialogMessage]:
        messages = await self.message_repo.list_for_dialog(dialog_id)

        for msg in messages:
            if msg.role == MessageRole.assistant:
                fragments = await self.fragment_repo.list_for_message(msg.id)
                if not fragments:
                    msg.citations = []
                    continue

                chunk_ids = [f.chunk_id for f in fragments]
                chunk_result = await self.session.execute(
                    select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids))
                )
                chunks_by_id = {c.id: c for c in chunk_result.scalars()}

                doc_ids = [c.document_id for c in chunks_by_id.values()]
                doc_result = await self.session.execute(
                    select(Document, DocumentFile)
                    .join(DocumentFile, Document.document_file_id == DocumentFile.id)
                    .where(Document.id.in_(doc_ids))
                )
                doc_names = {doc.id: doc_file.original_filename for doc, doc_file in doc_result.all()}

                msg.citations = []
                for frag in fragments:
                    chunk = chunks_by_id.get(frag.chunk_id)
                    if chunk:
                        msg.citations.append({
                            "chunk_id": frag.chunk_id,
                            "document_title": doc_names.get(chunk.document_id, "Unknown"),
                            "chunk_text": chunk.text[:500],
                            "similarity_score": frag.similarity_score,
                            "rerank_score": frag.rerank_score,
                        })

        return messages
