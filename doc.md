# DocDialog — Developer Guide

**DocDialog** — self-hosted RAG-система для интеллектуального диалога с документами.

ВКР МГТУ им. Баумана, ИУ5-75Б, Гонов М.И.

---

## Архитектура стека

| Слой | Технология |
|------|------------|
| Backend | Python 3.11 + FastAPI + SQLAlchemy async + asyncpg |
| LLM | LangChain → Ollama (default) или OpenAI (`LLM_PROVIDER=openai`) |
| Vector DB | Qdrant (Docker, port 6333) |
| Relational DB | PostgreSQL 16 (port 5432) |
| Embeddings | `intfloat/multilingual-e5-large` (dim=1024, RU+EN) |
| Re-ranker | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` |
| Document parsing | Docling (primary), python-docx/pdfplumber (fallback) |
| Task queue | Celery + Redis |
| Frontend | React + Vite + TypeScript + Zustand + React Router v6 |

### Структура директорий

```
DocDialog/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # auth, collections, documents, dialogs, users, health
│   │   ├── chunkers/        # recursive_chunker.py, transcript_chunker.py
│   │   ├── core/            # security.py (argon2+JWT), exceptions.py
│   │   ├── db/              # session.py (async), base.py
│   │   ├── embeddings/      # embedder.py (SentenceTransformer singleton)
│   │   ├── models/          # user, collection, document, dialog, query, llm, api_key
│   │   ├── parsers/         # docling_parser.py, txt_parser.py, registry.py
│   │   ├── reranker/        # cross_encoder_reranker.py
│   │   ├── repositories/    # base, user, collection, document, dialog
│   │   ├── schemas/         # auth, collection, document, dialog, common
│   │   ├── services/        # auth, collection, document, indexing, rag, dialog, summary, export
│   │   ├── tasks/           # celery_app.py, indexing_tasks.py
│   │   ├── vector_store/    # qdrant_client.py
│   │   ├── config.py        # Settings (pydantic-settings)
│   │   ├── dependencies.py  # get_current_user
│   │   └── main.py
│   ├── alembic/             # async migrations (asyncpg)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # client.ts (axios+interceptors), auth.ts, collections.ts, documents.ts
│   │   ├── components/
│   │   │   ├── chat/        # ChatWindow, MessageList, MessageBubble, ChatInput, CitationCard
│   │   │   ├── collections/ # CollectionCard, CollectionForm, CollectionEditModal, ShareCollectionModal
│   │   │   └── documents/   # DocumentList, DocumentUpload, DocumentStatusBadge, MoveDocumentModal
│   │   ├── pages/           # LoginPage, RegisterPage, CollectionsPage, CollectionDetailPage, SettingsPage
│   │   ├── router/          # index.tsx (protected routes)
│   │   ├── store/           # authStore, collectionStore, dialogStore, uiStore
│   │   └── types/           # auth, collection, dialog, document
│   └── nginx.conf           # proxy /api/ → backend:8000, proxy_buffering off (SSE)
├── docker-compose.yml
├── docker-compose.dev.yml
└── .env.example
```

---

## Реализованный функционал

- **Авторизация**: JWT (argon2), refresh token, роли (superuser / обычный пользователь)
- **Коллекции**: CRUD, совместный доступ (owner/editor/viewer)
- **Документы**: загрузка PDF/DOCX/TXT, фоновая индексация через Celery, прогресс-бар
- **RAG диалог**: embed → search → rerank → SSE streaming с цитатами
- **Multi-turn context**: последние 6 сообщений передаются в LLM
- **Авто-заголовки диалогов**: первый вопрос → LLM → title, SSE event `dialog_title`
- **Саммари**: map-reduce суммаризация коллекций и документов
- **Экспорт**: `GET /dialogs/{id}/export/pdf` → ReportLab PDF
- **Настройки**: управление LLM-провайдерами и API-ключами через UI

---

## SSE Contract

```
data: {"chunk": "текст чанка"}\n\n
...
data: {"citations": [{"chunk_id":"...", "document_title":"...", "chunk_text":"...", "similarity_score": 0.85, "rerank_score": 0.91}]}\n\n
data: {"dialog_title": "Краткий заголовок"}\n\n   # только при первом сообщении
data: {"error": "сообщение"}\n\n                   # при ошибке
```

---

## Запуск

### Требования

Ollama должен работать **нативно** на хосте (не в Docker) для использования Apple Metal GPU:

```bash
brew install ollama
ollama pull qwen2.5:7b
brew services start ollama
```

### Стек

```bash
# Скопировать и настроить переменные окружения
cp .env.example .env

# Запуск (production-like)
docker compose up -d

# Dev режим с hot-reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Миграции

```bash
cd backend
alembic upgrade head
```

### Frontend (dev)

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## Ключевые архитектурные инварианты

- `DocumentChunk.qdrant_point_id` — критическое поле; хранит привязку к Qdrant для удаления
- Embedder и Reranker — синглтоны, инициализируются лениво при первом запросе
- Nginx: `proxy_buffering off` обязателен для корректной передачи SSE-потока
- Celery worker — обязателен для фоновой индексации документов
- Qdrant collection name = `collection_{uuid}` (хранится в `Collection.qdrant_collection_name`)
- DB insert чанков предшествует Qdrant upsert: Qdrant point_id должен ссылаться на существующий `DocumentChunk`

---

## Модели БД

```
User ──< Collection ──< Document ──< DocumentChunk
                   ──< Dialog ──< DialogMessage ──< RelevantQueryFragment → DocumentChunk
Document ──── DocumentFile (хранит original_filename, path)
```
