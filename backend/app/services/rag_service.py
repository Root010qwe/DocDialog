import asyncio
import logging
import uuid
from typing import AsyncGenerator, TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.document import DocumentChunk
from app.embeddings.embedder import get_embedder
from app.vector_store.qdrant_client import search as search_qdrant
from app.reranker.cross_encoder_reranker import get_reranker
from app.config import settings

if TYPE_CHECKING:
    from app.models.dialog import DialogMessage

logger = logging.getLogger(__name__)


class RAGService:

    def __init__(self, session: AsyncSession):
        self.session = session
        self.embedder = get_embedder()
        self.reranker = get_reranker()
        self._llm_default = self._build_llm(temperature=0.1)
        self._llm_title = self._build_llm(temperature=0.3)

    async def embed_query(self, query: str):
        return await asyncio.to_thread(self.embedder.encode_query, query)

    async def search_relevant_chunks(
        self,
        query_vector,
        collection_id: uuid.UUID,
        top_k: int = 20,
    ) -> list[DocumentChunk]:
        from app.models.collection import Collection

        result = await self.session.execute(
            select(Collection).where(Collection.id == collection_id)
        )
        collection = result.scalars().first()
        if not collection:
            logger.warning("Collection not found: %s", collection_id)
            return []

        qdrant_collection_name = collection.qdrant_collection_name

        try:
            scored_points = search_qdrant(
                collection_name=qdrant_collection_name,
                query_vector=query_vector,
                limit=top_k,
            )
        except Exception as e:
            logger.error("Qdrant search error: %s", e)
            return []

        qdrant_point_ids = [str(point.id) for point in scored_points]
        if not qdrant_point_ids:
            return []

        db_result = await self.session.execute(
            select(DocumentChunk)
            .where(DocumentChunk.qdrant_point_id.in_(qdrant_point_ids))
        )
        chunks_by_qdrant_id = {str(c.qdrant_point_id): c for c in db_result.scalars()}

        chunks_with_scores = []
        for point in scored_points:
            chunk = chunks_by_qdrant_id.get(str(point.id))
            if chunk:
                chunk.similarity_score = point.score
                chunks_with_scores.append(chunk)

        return chunks_with_scores

    async def rerank_chunks(
        self,
        chunks: list[DocumentChunk],
        query: str,
        top_k: int = 5,
    ) -> list[DocumentChunk]:
        if not chunks:
            return []

        passages = [
            {
                "text": chunk.text,
                "metadata": {
                    "chunk_id": str(chunk.id),
                    "document_id": str(chunk.document_id),
                },
            }
            for chunk in chunks
        ]

        scored_passages = await self.reranker.rerank_async(
            query=query,
            passages=passages,
            top_k=top_k,
        )

        reranked_chunks = []
        for scored in scored_passages:
            chunk = next(
                c for c in chunks if c.id == uuid.UUID(scored.metadata["chunk_id"])
            )
            chunk.rerank_score = scored.score
            reranked_chunks.append(chunk)

        return reranked_chunks

    def _build_llm(self, temperature: float = 0.7):
        from langchain_ollama.chat_models import ChatOllama
        from langchain_openai import ChatOpenAI

        if settings.LLM_PROVIDER == "ollama":
            return ChatOllama(
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_MODEL,
                temperature=temperature,
                request_timeout=settings.LLM_REQUEST_TIMEOUT,
            )
        elif settings.LLM_PROVIDER == "openai":
            return ChatOpenAI(
                api_key=settings.OPENAI_API_KEY,
                model=settings.OPENAI_MODEL,
                temperature=temperature,
                timeout=settings.LLM_REQUEST_TIMEOUT,
            )
        raise ValueError(f"Unknown LLM provider: {settings.LLM_PROVIDER}")

    async def generate_streaming_response(
        self,
        chunks: list[DocumentChunk],
        query: str,
        history: list["DialogMessage"] | None = None,
    ) -> AsyncGenerator[str, None]:
        from langchain.schema.messages import HumanMessage, SystemMessage, AIMessage

        has_context = bool(chunks)
        if has_context:
            context_parts = [chunk.text for chunk in chunks]
            context_block = "\n\n---\n\n".join(context_parts)
        else:
            context_block = ""

        system_content = (
            "Ты — ассистент для поиска информации в документах.\n\n"
            "ПРАВИЛА (строго обязательны):\n"
            "1. Отвечай ТОЛЬКО на основе текста внутри тегов <context>. Никакой другой информации не существует.\n"
            "2. Если ответ есть в контексте — дай его коротко и точно, 1-3 предложения.\n"
            "3. Если информации нет в контексте — ответь буквально: «Данная информация не упоминается в документах.» Не придумывай.\n"
            "4. Не интерпретируй, не достраивай, не обобщай за пределами того, что написано.\n"
            "5. Контекст может быть транскриптом разговора — извлекай из него конкретные факты.\n"
            "6. Не добавляй ссылки на источники и не указывай названия файлов в ответе."
        )

        messages = [SystemMessage(content=system_content)]

        if history:
            for msg in history[-6:]:
                role = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
                if role == "user":
                    messages.append(HumanMessage(content=msg.content))
                elif role == "assistant" and msg.content and msg.content.strip():
                    messages.append(AIMessage(content=msg.content))

        if has_context:
            user_content = (
                f"<context>\n{context_block}\n</context>\n\n"
                f"Вопрос: {query}\n\n"
                f"Ответ (только на основе контекста выше):"
            )
        else:
            user_content = (
                f"Вопрос: {query}\n\n"
                f"Релевантные фрагменты не найдены. Ответ: «Данная информация не упоминается в документах.»"
            )
        messages.append(HumanMessage(content=user_content))

        async for chunk in self._llm_default.astream(messages):
            if hasattr(chunk, "content") and chunk.content:
                yield chunk.content

    async def generate_dialog_title(self, first_query: str) -> str:
        from langchain.schema.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=(
                "Придумай краткий заголовок (3–6 слов) для диалога на основе вопроса пользователя. "
                "Отвечай только заголовком — без кавычек, без точки в конце."
            )),
            HumanMessage(content=f"Вопрос пользователя: {first_query[:300]}"),
        ]
        try:
            response = await self._llm_title.ainvoke(messages)
            title = response.content.strip()[:120]
            return title or first_query[:80]
        except Exception as e:
            logger.warning("Title generation failed: %s", e)
            return first_query[:80]
