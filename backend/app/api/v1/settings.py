import logging
import uuid
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.api_key import APIKey
from app.models.llm import LLM
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


# ── LLM settings ──────────────────────────────────────────────────────────────

class LLMSettingsRead(BaseModel):
    provider: str
    model_name: str
    max_tokens: int
    temperature: float


class LLMSettingsUpdate(BaseModel):
    provider: str
    model_name: str
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None


@router.get("/llm", response_model=LLMSettingsRead)
async def get_llm_settings(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(LLM).where(LLM.is_default == True).limit(1)  # noqa: E712
    )
    llm = result.scalar_one_or_none()
    if not llm:
        return LLMSettingsRead(
            provider=settings.LLM_PROVIDER,
            model_name=settings.OLLAMA_MODEL if settings.LLM_PROVIDER == "ollama" else settings.OPENAI_MODEL,
            max_tokens=2048,
            temperature=0.1,
        )
    return LLMSettingsRead(
        provider=llm.provider,
        model_name=llm.model_name,
        max_tokens=llm.max_tokens,
        temperature=llm.temperature,
    )


@router.patch("/llm", response_model=LLMSettingsRead)
async def update_llm_settings(
    data: LLMSettingsUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    if data.provider not in ("ollama", "openai"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="provider must be 'ollama' or 'openai'")

    result = await session.execute(select(LLM).where(LLM.is_default == True))  # noqa: E712
    for existing in result.scalars().all():
        existing.is_default = False
        session.add(existing)

    result2 = await session.execute(
        select(LLM).where(LLM.provider == data.provider, LLM.model_name == data.model_name).limit(1)
    )
    llm = result2.scalar_one_or_none()
    if llm:
        llm.is_default = True
        if data.max_tokens is not None:
            llm.max_tokens = data.max_tokens
        if data.temperature is not None:
            llm.temperature = data.temperature
    else:
        llm = LLM(
            provider=data.provider,
            model_name=data.model_name,
            max_tokens=data.max_tokens or 2048,
            temperature=data.temperature if data.temperature is not None else 0.1,
            is_default=True,
        )
        session.add(llm)

    await session.commit()
    await session.refresh(llm)

    settings.LLM_PROVIDER = llm.provider  # type: ignore[assignment]
    if llm.provider == "ollama":
        settings.OLLAMA_MODEL = llm.model_name  # type: ignore[assignment]
    elif llm.provider == "openai":
        settings.OPENAI_MODEL = llm.model_name  # type: ignore[assignment]

    logger.info("LLM updated: provider=%s model=%s", llm.provider, llm.model_name)
    return LLMSettingsRead(
        provider=llm.provider, model_name=llm.model_name,
        max_tokens=llm.max_tokens, temperature=llm.temperature,
    )


# ── Ollama ────────────────────────────────────────────────────────────────────

class OllamaModelsResponse(BaseModel):
    connected: bool
    models: list[str]
    ollama_url: Optional[str] = None
    error: Optional[str] = None


@router.get("/ollama/models", response_model=OllamaModelsResponse)
async def get_ollama_models(current_user: User = Depends(get_current_user)):
    url = f"{settings.OLLAMA_BASE_URL}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            model_names = [m["name"] for m in data.get("models", [])]
            return OllamaModelsResponse(connected=True, models=model_names, ollama_url=settings.OLLAMA_BASE_URL)
    except Exception as exc:
        logger.warning("Cannot reach Ollama at %s: %s", url, exc)
        return OllamaModelsResponse(connected=False, models=[], ollama_url=settings.OLLAMA_BASE_URL, error=str(exc))


# ── Performance ────────────────────────────────────────────────────────────────

def _model_size_b(model_name: str) -> float:
    import re
    m = re.search(r"(\d+\.?\d*)b", model_name, re.IGNORECASE)
    return float(m.group(1)) if m else 7.0


class PerformanceInfo(BaseModel):
    model: str
    provider: str
    ollama_url: Optional[str] = None
    secs_per_summary_group: int
    secs_per_chat_response: int
    note: str


@router.get("/performance", response_model=PerformanceInfo)
async def get_performance_info(current_user: User = Depends(get_current_user)):
    model = settings.OLLAMA_MODEL if settings.LLM_PROVIDER == "ollama" else settings.OPENAI_MODEL
    provider = settings.LLM_PROVIDER

    if provider == "openai":
        return PerformanceInfo(
            model=model, provider=provider,
            secs_per_summary_group=2, secs_per_chat_response=3,
            note="OpenAI API — скорость зависит от нагрузки серверов",
        )

    size = _model_size_b(model)
    if size <= 2:
        secs_g, secs_c, note = 4, 3, "Лёгкая модель — быстрые ответы"
    elif size <= 4:
        secs_g, secs_c, note = 7, 5, "Компактная модель — хороший баланс"
    elif size <= 8:
        secs_g, secs_c, note = 15, 10, "Модель среднего размера — 7–8B параметров"
    elif size <= 14:
        secs_g, secs_c, note = 25, 18, "Крупная модель — высокое качество"
    else:
        secs_g, secs_c, note = 45, 30, "Очень крупная модель — медленный инференс"

    return PerformanceInfo(
        model=model, provider=provider, ollama_url=settings.OLLAMA_BASE_URL,
        secs_per_summary_group=secs_g, secs_per_chat_response=secs_c, note=note,
    )


# ── LLM connection test ────────────────────────────────────────────────────────

class LLMTestResponse(BaseModel):
    ok: bool
    provider: str
    model: str
    error: Optional[str] = None


@router.get("/llm/test", response_model=LLMTestResponse)
async def test_llm_connection(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(LLM).where(LLM.is_default == True).limit(1))  # noqa: E712
    llm_record = result.scalar_one_or_none()
    provider = llm_record.provider if llm_record else settings.LLM_PROVIDER
    raw_model = (
        llm_record.model_name if llm_record
        else (settings.OLLAMA_MODEL if provider == "ollama" else settings.OPENAI_MODEL)
    )
    # Guard against corrupted model name (API key stored as model)
    model = raw_model if raw_model and not raw_model.startswith("sk-") else (
        "gpt-4o-mini" if provider == "openai" else "qwen2.5:7b"
    )

    try:
        from langchain.schema.messages import HumanMessage
        if provider == "ollama":
            from langchain_ollama.chat_models import ChatOllama
            llm = ChatOllama(base_url=settings.OLLAMA_BASE_URL, model=model, temperature=0, num_predict=5)
        else:
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(api_key=settings.OPENAI_API_KEY, model=model, temperature=0, max_tokens=5)
        await llm.ainvoke([HumanMessage(content="ping")])
        return LLMTestResponse(ok=True, provider=provider, model=model)
    except Exception as exc:
        return LLMTestResponse(ok=False, provider=provider, model=model, error=str(exc))


# ── API key management ────────────────────────────────────────────────────────

def _mask_key(key_value: str) -> str:
    if len(key_value) <= 4:
        return "****"
    return f"****...{key_value[-4:]}"


class APIKeyRead(BaseModel):
    id: uuid.UUID
    provider: str
    label: str
    masked_key: str
    is_active: bool
    created_at: datetime


class APIKeyCreate(BaseModel):
    provider: str = "openai"
    label: str
    key_value: str
    activate: bool = True


class APIKeyTestResponse(BaseModel):
    ok: bool
    error: Optional[str] = None


@router.get("/api-keys", response_model=list[APIKeyRead])
async def list_api_keys(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(APIKey).order_by(APIKey.created_at.desc()))
    keys = result.scalars().all()
    return [
        APIKeyRead(
            id=k.id, provider=k.provider, label=k.label,
            masked_key=_mask_key(k.key_value), is_active=k.is_active, created_at=k.created_at,
        )
        for k in keys
    ]


@router.post("/api-keys", response_model=APIKeyRead, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: APIKeyCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    if data.provider not in ("openai",):
        raise HTTPException(status_code=400, detail="Unsupported provider")
    if not data.key_value.strip():
        raise HTTPException(status_code=400, detail="key_value must not be empty")

    if data.activate:
        # Deactivate all existing keys for this provider
        existing = await session.execute(
            select(APIKey).where(APIKey.provider == data.provider, APIKey.is_active == True)  # noqa: E712
        )
        for k in existing.scalars().all():
            k.is_active = False
            session.add(k)

    key = APIKey(
        provider=data.provider,
        label=data.label.strip() or data.provider,
        key_value=data.key_value.strip(),
        is_active=data.activate,
    )
    session.add(key)
    await session.commit()
    await session.refresh(key)

    if data.activate:
        _apply_api_key(key.provider, key.key_value)
        logger.info("API key activated: provider=%s label=%s", key.provider, key.label)

    return APIKeyRead(
        id=key.id, provider=key.provider, label=key.label,
        masked_key=_mask_key(key.key_value), is_active=key.is_active, created_at=key.created_at,
    )


@router.post("/api-keys/{key_id}/activate", response_model=APIKeyRead)
async def activate_api_key(
    key_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(APIKey).where(APIKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    # Deactivate others of same provider
    existing = await session.execute(
        select(APIKey).where(APIKey.provider == key.provider, APIKey.is_active == True)  # noqa: E712
    )
    for k in existing.scalars().all():
        k.is_active = False
        session.add(k)

    key.is_active = True
    session.add(key)
    await session.commit()
    await session.refresh(key)

    _apply_api_key(key.provider, key.key_value)
    logger.info("API key switched: provider=%s label=%s", key.provider, key.label)

    return APIKeyRead(
        id=key.id, provider=key.provider, label=key.label,
        masked_key=_mask_key(key.key_value), is_active=key.is_active, created_at=key.created_at,
    )


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Требуются права администратора")
    result = await session.execute(select(APIKey).where(APIKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    await session.delete(key)
    await session.commit()


@router.get("/api-keys/{key_id}/test", response_model=APIKeyTestResponse)
async def test_api_key(
    key_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(select(APIKey).where(APIKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    raw_model = settings.OPENAI_MODEL if key.provider == "openai" else ""
    # Guard: if OPENAI_MODEL was corrupted (stored an API key), fall back to a safe default
    model = raw_model if raw_model and not raw_model.startswith("sk-") else "gpt-4o-mini"
    try:
        from langchain.schema.messages import HumanMessage
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(api_key=key.key_value, model=model, temperature=0, max_tokens=5)
        await llm.ainvoke([HumanMessage(content="ping")])
        return APIKeyTestResponse(ok=True)
    except Exception as exc:
        return APIKeyTestResponse(ok=False, error=str(exc))


def _apply_api_key(provider: str, key_value: str) -> None:
    if provider == "openai":
        settings.OPENAI_API_KEY = key_value  # type: ignore[assignment]
