import uuid
from typing import Optional, Literal

from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.collection import CollectionRole, RoleInCollection
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.repositories.collection_repo import CollectionRepository
from app.services.collection_service import CollectionService

router = APIRouter(prefix="/collections/{collection_id}/members", tags=["roles"])


class MemberAdd(BaseModel):
    email: str
    role: Literal["editor", "viewer"]


class MemberUpdate(BaseModel):
    role: Literal["editor", "viewer", "owner"]


class MemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    email: str
    full_name: Optional[str]
    role: str


async def _require_owner(
    collection_id: uuid.UUID,
    current_user: User,
    session: AsyncSession,
) -> None:
    col_repo = CollectionRepository(session)
    collection = await col_repo.get(collection_id)
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    if collection.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the collection owner can manage members",
        )


@router.get("", response_model=list[MemberRead])
async def list_members(
    collection_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    col_service = CollectionService(session)
    await col_service.get(collection_id, current_user)  # verifies access

    result = await session.execute(
        select(RoleInCollection, User)
        .join(User, RoleInCollection.user_id == User.id)
        .where(RoleInCollection.collection_id == collection_id)
    )
    rows = result.all()
    return [
        MemberRead(
            user_id=role.user_id,
            email=user.email,
            full_name=user.full_name,
            role=role.role.value,
        )
        for role, user in rows
    ]


@router.post("", response_model=MemberRead, status_code=status.HTTP_201_CREATED)
async def add_member(
    collection_id: uuid.UUID,
    data: MemberAdd,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_owner(collection_id, current_user, session)

    user_repo = UserRepository(session)
    target_user = await user_repo.get_by_email(data.email)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add yourself; you are already the owner",
        )

    existing = await session.execute(
        select(RoleInCollection).where(
            RoleInCollection.collection_id == collection_id,
            RoleInCollection.user_id == target_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already has a role in this collection",
        )

    new_role = RoleInCollection(
        user_id=target_user.id,
        collection_id=collection_id,
        role=CollectionRole(data.role),
    )
    session.add(new_role)
    await session.commit()

    return MemberRead(
        user_id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=data.role,
    )


@router.patch("/{user_id}", response_model=MemberRead)
async def update_member_role(
    collection_id: uuid.UUID,
    user_id: uuid.UUID,
    data: MemberUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_owner(collection_id, current_user, session)

    result = await session.execute(
        select(RoleInCollection, User)
        .join(User, RoleInCollection.user_id == User.id)
        .where(
            RoleInCollection.collection_id == collection_id,
            RoleInCollection.user_id == user_id,
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    role_record, user = row
    role_record.role = CollectionRole(data.role)
    session.add(role_record)
    await session.commit()

    return MemberRead(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=data.role,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    collection_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_owner(collection_id, current_user, session)

    result = await session.execute(
        select(RoleInCollection).where(
            RoleInCollection.collection_id == collection_id,
            RoleInCollection.user_id == user_id,
        )
    )
    role_record = result.scalar_one_or_none()
    if not role_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    await session.delete(role_record)
    await session.commit()
