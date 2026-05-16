import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dialog import Dialog, DialogMessage
from app.models.query import RelevantQueryFragment
from app.repositories.base import BaseRepository


class DialogRepository(BaseRepository[Dialog]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Dialog, session)

    async def list_for_user(self, user_id: uuid.UUID) -> list[Dialog]:
        result = await self.session.execute(
            select(Dialog).where(Dialog.user_id == user_id).order_by(Dialog.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_for_collection(self, collection_id: uuid.UUID) -> list[Dialog]:
        result = await self.session.execute(
            select(Dialog)
            .where(Dialog.collection_id == collection_id)
            .order_by(Dialog.created_at.desc())
        )
        return list(result.scalars().all())


class DialogMessageRepository(BaseRepository[DialogMessage]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(DialogMessage, session)

    async def list_for_dialog(self, dialog_id: uuid.UUID) -> list[DialogMessage]:
        result = await self.session.execute(
            select(DialogMessage)
            .where(DialogMessage.dialog_id == dialog_id)
            .order_by(DialogMessage.created_at.asc())
        )
        return list(result.scalars().all())


class RelevantQueryFragmentRepository(BaseRepository[RelevantQueryFragment]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(RelevantQueryFragment, session)

    async def list_for_message(self, message_id: uuid.UUID) -> list[RelevantQueryFragment]:
        result = await self.session.execute(
            select(RelevantQueryFragment)
            .where(RelevantQueryFragment.dialog_message_id == message_id)
            .order_by(RelevantQueryFragment.rank_position.asc())
        )
        return list(result.scalars().all())
