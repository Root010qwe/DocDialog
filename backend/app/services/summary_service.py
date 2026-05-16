import logging
import uuid
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.document import DocumentChunk, Document
from app.config import settings

logger = logging.getLogger(__name__)

# Max chars per group for map phase (~1500 tokens at 4 chars/token)
_MAP_CHUNK_SIZE = 6000
# Max groups to summarise (caps wall-clock time; 8 × ~15 s ≈ 2 min on M4)
_MAX_SUMMARIES = 8


class SummaryService:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _build_llm(self, temperature: float = 0.3, num_predict: int | None = None):
        from langchain_ollama.chat_models import ChatOllama
        from langchain_openai import ChatOpenAI

        if settings.LLM_PROVIDER == "ollama":
            kwargs: dict = dict(
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_MODEL,
                temperature=temperature,
                request_timeout=settings.LLM_REQUEST_TIMEOUT,
                num_ctx=2048,
            )
            if num_predict is not None:
                kwargs["num_predict"] = num_predict
            return ChatOllama(**kwargs)
        elif settings.LLM_PROVIDER == "openai":
            return ChatOpenAI(
                api_key=settings.OPENAI_API_KEY,
                model=settings.OPENAI_MODEL,
                temperature=temperature,
                timeout=settings.LLM_REQUEST_TIMEOUT,
            )
        raise ValueError(f"Unknown LLM provider: {settings.LLM_PROVIDER}")

    async def _get_chunks_for_collection(self, collection_id: uuid.UUID) -> list[str]:
        result = await self.session.execute(
            select(DocumentChunk)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(Document.collection_id == collection_id)
            .order_by(DocumentChunk.chunk_index.asc())
        )
        chunks = result.scalars().all()
        return [c.text for c in chunks if c.text and c.text.strip()]

    async def _get_chunks_for_document(self, document_id: uuid.UUID) -> list[str]:
        result = await self.session.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index.asc())
        )
        chunks = result.scalars().all()
        return [c.text for c in chunks if c.text and c.text.strip()]

    def _group_texts(self, texts: list[str]) -> list[str]:
        groups: list[str] = []
        current: list[str] = []
        current_len = 0
        for text in texts:
            if current_len + len(text) > _MAP_CHUNK_SIZE and current:
                groups.append("\n\n".join(current))
                current, current_len = [], 0
            current.append(text)
            current_len += len(text)
        if current:
            groups.append("\n\n".join(current))
        return groups

    async def _summarize_one(self, llm, text: str) -> str | None:
        from langchain.schema.messages import HumanMessage, SystemMessage
        system = SystemMessage(content=(
            "Ты — аналитик документов. Напиши краткое резюме фрагмента текста "
            "в 2–3 предложениях. Выдели только ключевые факты."
        ))
        try:
            response = await llm.ainvoke([
                system,
                HumanMessage(content=f"Текст:\n{text}\n\nРезюме:"),
            ])
            return response.content.strip() or None
        except Exception as e:
            logger.warning("Map summarize failed: %s", e)
            return None

    async def _reduce_summarize(self, llm, summaries: list[str], topic: str) -> str:
        from langchain.schema.messages import HumanMessage, SystemMessage

        combined = "\n\n".join(f"- {s}" for s in summaries)
        system = SystemMessage(content=(
            "Ты — аналитик документов. На основе промежуточных резюме напиши "
            "итоговое аналитическое резюме. "
            "Структурируй ответ: главная тема, ключевые разделы, основные выводы. "
            "Объём: 150–300 слов."
        ))
        try:
            response = await llm.ainvoke([
                system,
                HumanMessage(content=f"Промежуточные резюме ({topic}):\n{combined}\n\nИтоговое резюме:"),
            ])
            return response.content.strip() or "Не удалось сформировать итоговое резюме."
        except Exception as e:
            logger.error("Reduce phase failed: %s", e)
            return "Не удалось сформировать итоговое резюме."

    async def summarize_collection_streaming(
        self, collection_id: uuid.UUID
    ) -> AsyncGenerator[str, None]:
        texts = await self._get_chunks_for_collection(collection_id)
        if not texts:
            yield "Коллекция не содержит проиндексированных документов."
            return

        map_llm = self._build_llm(temperature=0.1, num_predict=120)
        reduce_llm = self._build_llm(temperature=0.3)
        groups = self._group_texts(texts)
        total = min(len(groups), _MAX_SUMMARIES)
        logger.info("Summary: collection=%s chunks=%d groups=%d (processing %d)",
                    collection_id, len(texts), len(groups), total)

        yield f"Анализирую {len(texts)} фрагментов документов ({total} из {len(groups)} групп)...\n"

        summaries: list[str] = []
        for i, group_text in enumerate(groups[:_MAX_SUMMARIES]):
            yield f"Группа {i + 1}/{total}...\n"
            result = await self._summarize_one(map_llm, group_text)
            if result:
                summaries.append(result)

        if not summaries:
            yield "Не удалось извлечь содержание коллекции."
            return

        yield "Формирую итоговое резюме...\n"
        final = await self._reduce_summarize(reduce_llm, summaries, "коллекция документов")
        yield final

    async def summarize_document_streaming(
        self, document_id: uuid.UUID
    ) -> AsyncGenerator[str, None]:
        texts = await self._get_chunks_for_document(document_id)
        if not texts:
            yield "Документ не проиндексирован или пуст."
            return

        map_llm = self._build_llm(temperature=0.1, num_predict=120)
        reduce_llm = self._build_llm(temperature=0.3)
        groups = self._group_texts(texts)
        total = min(len(groups), _MAX_SUMMARIES)
        logger.info("Summary: document=%s chunks=%d groups=%d (processing %d)",
                    document_id, len(texts), len(groups), total)

        yield f"Анализирую {len(texts)} фрагментов документа ({total} из {len(groups)} групп)...\n"

        summaries: list[str] = []
        for i, group_text in enumerate(groups[:_MAX_SUMMARIES]):
            yield f"Группа {i + 1}/{total}...\n"
            result = await self._summarize_one(map_llm, group_text)
            if result:
                summaries.append(result)

        if not summaries:
            yield "Не удалось извлечь содержание документа."
            return

        yield "Формирую итоговое резюме...\n"
        final = await self._reduce_summarize(reduce_llm, summaries, "документ")
        yield final
