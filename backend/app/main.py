from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.config import settings
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Verify DB connection
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

    # Verify Qdrant connection
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            await client.get(f"{settings.QDRANT_URL}/readyz")
        except Exception:
            pass  # Non-fatal; qdrant health shown in /health endpoint

    yield

    # Shutdown
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
