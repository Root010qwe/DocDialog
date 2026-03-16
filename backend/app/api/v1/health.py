from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
import httpx

from app.config import settings
from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(session: AsyncSession = Depends(get_db)):
    result = {"status": "ok", "db": "ok", "qdrant": "unknown", "ollama": "unknown"}

    # Check DB
    try:
        await session.execute(text("SELECT 1"))
    except Exception as e:
        result["db"] = f"error: {e}"
        result["status"] = "degraded"

    # Check Qdrant
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{settings.QDRANT_URL}/readyz")
            result["qdrant"] = "ok" if resp.status_code == 200 else f"error: {resp.status_code}"
    except Exception as e:
        result["qdrant"] = f"error: {e}"

    # Check Ollama (only if using ollama provider)
    if settings.LLM_PROVIDER == "ollama":
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                result["ollama"] = "ok" if resp.status_code == 200 else f"error: {resp.status_code}"
        except Exception as e:
            result["ollama"] = f"error: {e}"
    else:
        result["ollama"] = "n/a (using openai)"

    return result
