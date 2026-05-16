<div align="center">

# DocDialog

**Интеллектуальная система диалогового анализа документов**

Self-hosted RAG-система: загрузите документы, задайте вопрос — получите ответ с указанием источника. Без облаков, без утечки данных.

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Qdrant](https://img.shields.io/badge/Qdrant-1.9-DC244C?style=flat-square)](https://qdrant.tech)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)

*ВКР · МГТУ им. Баумана · Кафедра ИУ5 · 2026*

</div>

---

## О проекте

DocDialog позволяет задавать вопросы к корпусу документов на естественном языке и получать точные ответы со ссылками на источники. Система работает полностью локально — ваши документы не покидают сервер.

**Ключевые свойства:**
- Ответы основаны исключительно на загруженных документах (source-grounded)
- Потоковая генерация с указанием цитат и оценок релевантности
- Поддержка русского и английского языков (multilingual embeddings)
- Переключение между локальным Ollama и OpenAI без перезапуска

---

## Возможности

| Раздел | Что умеет |
|--------|-----------|
| **Коллекции** | Создание, переименование, удаление; совместный доступ (owner / editor / viewer) |
| **Документы** | Загрузка PDF, DOCX, TXT; фоновая индексация с прогресс-баром; перемещение между коллекциями |
| **Диалог** | Семантический поиск → реранжирование → потоковый ответ (SSE) с цитатами |
| **Контекст** | Учёт истории диалога (последние 6 сообщений) при генерации |
| **Экспорт** | Выгрузка истории диалога в PDF с вопросами, ответами и источниками |
| **Саммари** | Автоматическая аналитическая сводка по всей коллекции (map-reduce через LLM) |
| **Настройки** | Выбор LLM-провайдера, модели, стиля и длины ответов; управление API-ключами |
| **Безопасность** | JWT-авторизация, argon2-хэширование, ролевое разграничение доступа |

---

## RAG-пайплайн

```
Документ (PDF / DOCX / TXT)
         │
         ▼ Docling + RecursiveChunker
   Чанки (~400 токенов, overlap 20%)
         │
         ▼ intfloat/multilingual-e5-large
   Векторы (1024-d, cosine similarity)
         │
         ▼ Qdrant  ←──── Запрос пользователя (embed)
   Top-20 кандидатов
         │
         ▼ CrossEncoder (mmarco-mMiniLMv2, multilingual)
   Top-5 реранжированных чанков
         │
         ▼ Ollama (qwen2.5:7b) / OpenAI (gpt-4o)
   Потоковый ответ + цитаты  ──→  SSE → Frontend
```

---

## Стек технологий

| Слой | Технология |
|------|------------|
| **Backend** | Python 3.11, FastAPI, SQLAlchemy (async), asyncpg |
| **LLM** | LangChain → Ollama (qwen2.5:7b) или OpenAI (gpt-4o) |
| **Векторная БД** | Qdrant v1.9 |
| **Реляционная БД** | PostgreSQL 16 |
| **Эмбеддинги** | `intfloat/multilingual-e5-large` (dim=1024, RU+EN) |
| **Реранкер** | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` |
| **Парсинг документов** | Docling (PDF, DOCX, TXT), pdfplumber, python-docx |
| **Очередь задач** | Celery + Redis |
| **Frontend** | React 18, Vite, TypeScript, Zustand, Tailwind CSS v4 |
| **Прокси** | Nginx (SSE: `proxy_buffering off`) |

---

## Быстрый старт

### Системные требования

| Компонент | Минимум |
|-----------|---------|
| CPU | 2 ГГц, 4+ ядра (рекомендуется) |
| RAM | 8 ГБ (16 ГБ для комфортной работы с LLM) |
| Дисковое пространство | 20 ГБ (модели ~10 ГБ, данные) |
| Docker | 24.0+ |
| Docker Compose | 2.20+ |
| ОС | Linux (Ubuntu 22.04+) или macOS |

### 1. Ollama (для локального LLM)

> Ollama запускается **нативно** на хосте — не в Docker. Это необходимо для доступа к GPU (Apple Metal / CUDA).

```bash
# macOS
brew install ollama && ollama pull qwen2.5:7b && brew services start ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull qwen2.5:7b
ollama serve &
```

### 2. Запуск стека

```bash
git clone https://github.com/Root010qwe/DocDialog.git
cd DocDialog

# Настроить переменные окружения
cp .env.example .env
# Отредактировать .env: задать JWT_SECRET_KEY и при необходимости OPENAI_API_KEY

# Запустить
docker compose up -d

# Применить миграции БД (при первом запуске)
docker compose exec backend alembic upgrade head
```

После запуска:
- **Интерфейс:** [http://localhost](http://localhost)
- **API docs:** [http://localhost/api/docs](http://localhost/api/docs)

### 3. Режим разработки (hot reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
# Frontend доступен на http://localhost:5173
```

### 4. Только инфраструктура

```bash
# PostgreSQL + Qdrant + Redis без backend
docker compose up -d postgres qdrant redis

# Backend локально
cd backend && pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

---

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

| Переменная | Описание | Пример |
|------------|----------|--------|
| `JWT_SECRET_KEY` | Секрет для JWT (мин. 32 символа) | `openssl rand -hex 32` |
| `LLM_PROVIDER` | Провайдер LLM | `ollama` или `openai` |
| `OLLAMA_MODEL` | Модель Ollama | `qwen2.5:7b` |
| `OPENAI_API_KEY` | API-ключ OpenAI | `sk-...` |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL | строка |

---

## Структура проекта

```
DocDialog/
├── backend/
│   ├── app/
│   │   ├── api/v1/        # REST endpoints: auth, collections, documents, dialogs
│   │   ├── services/      # RAGService, IndexingService, SummaryService, ExportService
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── parsers/       # Docling, python-docx, pdfplumber
│   │   ├── chunkers/      # RecursiveChunker, TranscriptChunker
│   │   ├── embeddings/    # SentenceTransformer singleton
│   │   ├── reranker/      # CrossEncoder reranker
│   │   ├── vector_store/  # Qdrant client wrapper
│   │   └── tasks/         # Celery indexing tasks
│   └── alembic/           # Database migrations
├── frontend/
│   ├── src/
│   │   ├── components/    # chat/, collections/, documents/, ui/
│   │   ├── pages/         # CollectionsPage, CollectionDetailPage, SettingsPage
│   │   ├── store/         # Zustand: authStore, collectionStore, dialogStore
│   │   └── api/           # axios client + typed API modules
│   └── nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## Архитектура базы данных

```
User ──< Collection ──< Document ──< DocumentChunk ──── Qdrant
                   ──< Dialog   ──< DialogMessage
                                        └──< RelevantQueryFragment → DocumentChunk
Document ──── DocumentFile (путь, MIME-тип)
Collection ──< RoleInCollection → User
```

---

## SSE-контракт (диалог)

Endpoint `POST /api/v1/dialogs/{id}/messages` возвращает `text/event-stream`:

```
data: {"chunk": "Срок поставки"}            # текстовый фрагмент ответа
data: {"chunk": " — 30 рабочих дней..."}
data: {"citations": [{
  "chunk_id": "...",
  "document_title": "Договор_2024.pdf",
  "chunk_text": "...",
  "similarity_score": 0.91,
  "rerank_score": 0.87
}]}
data: {"dialog_title": "Срок поставки по договору"}   # только при первом сообщении
```

---

## Разработка

```bash
# Backend линтинг и типизация
cd backend
ruff check app/
mypy app/

# Frontend
cd frontend
npm run lint
npm run build   # TypeScript + Vite production build
```

---

<div align="center">

**МГТУ им. Н.Э. Баумана** · Кафедра «Системы обработки информации и управления»

Выпускная квалификационная работа · ИУ5-85Б · Гонов М.И. · 2026

</div>
