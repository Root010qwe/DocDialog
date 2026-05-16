from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.config import settings
from app.db.session import engine


async def _load_active_api_key_from_db() -> None:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    from app.models.api_key import APIKey

    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(APIKey).where(APIKey.is_active == True).limit(1)  # noqa: E712
        )
        key = result.scalar_one_or_none()
        if key and key.provider == "openai":
            settings.OPENAI_API_KEY = key.key_value  # type: ignore[assignment]
            import logging
            logging.getLogger(__name__).info("Active OpenAI API key loaded from DB: %s", key.label)


async def _load_llm_settings_from_db() -> None:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    from app.models.llm import LLM

    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(LLM).where(LLM.is_default == True).limit(1)  # noqa: E712
        )
        llm = result.scalar_one_or_none()
        if llm:
            settings.LLM_PROVIDER = llm.provider  # type: ignore[assignment]
            if llm.provider == "ollama":
                settings.OLLAMA_MODEL = llm.model_name  # type: ignore[assignment]
            elif llm.provider == "openai":
                settings.OPENAI_MODEL = llm.model_name  # type: ignore[assignment]
            import logging
            logging.getLogger(__name__).info(
                "LLM settings loaded from DB: provider=%s model=%s", llm.provider, llm.model_name
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

    async with httpx.AsyncClient(timeout=5) as client:
        try:
            await client.get(f"{settings.QDRANT_URL}/readyz")
        except Exception:
            pass

    try:
        await _load_llm_settings_from_db()
    except Exception:
        pass

    try:
        await _load_active_api_key_from_db()
    except Exception:
        pass

    yield

    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="DocDialog API",
        description="Intelligent document dialogue analysis system",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
