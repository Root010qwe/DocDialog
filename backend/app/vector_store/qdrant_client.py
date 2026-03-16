import logging
import uuid
from typing import Any

from qdrant_client import QdrantClient as _QdrantClient
from qdrant_client.http.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    ScoredPoint,
)

from app.config import settings

logger = logging.getLogger(__name__)

_client_instance: "_QdrantClient | None" = None


def get_qdrant() -> "_QdrantClient":
    global _client_instance
    if _client_instance is None:
        _client_instance = _QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY or None,
            timeout=30,
        )
        logger.info("Qdrant client initialised: %s", settings.QDRANT_URL)
    return _client_instance


def ensure_collection(collection_name: str) -> None:
    """Create Qdrant collection if it doesn't exist."""
    client = get_qdrant()
    existing = {c.name for c in client.get_collections().collections}
    if collection_name not in existing:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=settings.EMBEDDING_DIM,
                distance=Distance.COSINE,
            ),
        )
        logger.info("Created Qdrant collection: %s", collection_name)


def upsert_points(
    collection_name: str,
    points: list[dict],  # [{"id": uuid, "vector": [...], "payload": {...}}]
) -> None:
    client = get_qdrant()
    ensure_collection(collection_name)
    structs = [
        PointStruct(
            id=str(p["id"]),
            vector=p["vector"].tolist() if hasattr(p["vector"], "tolist") else p["vector"],
            payload=p["payload"],
        )
        for p in points
    ]
    client.upsert(collection_name=collection_name, points=structs, wait=True)


def search(
    collection_name: str,
    query_vector: Any,
    limit: int = 20,
    filter_document_ids: list[str] | None = None,
) -> list[ScoredPoint]:
    client = get_qdrant()
    vector = query_vector.tolist() if hasattr(query_vector, "tolist") else query_vector

    query_filter = None
    if filter_document_ids:
        query_filter = Filter(
            should=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=doc_id),
                )
                for doc_id in filter_document_ids
            ]
        )

    return client.search(
        collection_name=collection_name,
        query_vector=vector,
        limit=limit,
        query_filter=query_filter,
        with_payload=True,
    )


def delete_points_by_document(collection_name: str, document_id: str) -> None:
    """Delete all Qdrant points belonging to a document."""
    client = get_qdrant()
    client.delete(
        collection_name=collection_name,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id),
                )
            ]
        ),
    )
