import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.collection import CollectionCreate, CollectionUpdate, CollectionRead
from app.schemas.common import PaginatedResponse
from app.services.collection_service import CollectionService

router = APIRouter(prefix="/collections", tags=["collections"])


@router.post("", response_model=CollectionRead, status_code=status.HTTP_201_CREATED)
async def create_collection(
    data: CollectionCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    return await service.create(data, current_user)


@router.get("", response_model=list[CollectionRead])
async def list_collections(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    return await service.list_for_user(current_user)


@router.get("/{collection_id}", response_model=CollectionRead)
async def get_collection(
    collection_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    return await service.get(collection_id, current_user)


@router.patch("/{collection_id}", response_model=CollectionRead)
async def update_collection(
    collection_id: uuid.UUID,
    data: CollectionUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    return await service.update(collection_id, data, current_user)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CollectionService(session)
    await service.delete(collection_id, current_user)
