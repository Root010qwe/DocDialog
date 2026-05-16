from fastapi import APIRouter

from app.api.v1 import auth, health, users, collections, documents, dialogs, roles, settings

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(collections.router)
api_router.include_router(documents.router)
api_router.include_router(dialogs.router)
api_router.include_router(roles.router)
api_router.include_router(settings.router)
