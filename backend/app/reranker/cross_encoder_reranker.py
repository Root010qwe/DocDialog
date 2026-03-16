import logging
import os
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_reranker_instance = None


def get_reranker() -> "CrossEncoderReranker":
    global _reranker_instance
    if _reranker_instance is None:
        _reranker_instance = CrossEncoderReranker()
    return _reranker_instance


@dataclass
class ScoredPassage:
    text: str
    score: float
    original_index: int
    metadata: dict


class CrossEncoderReranker:
    def __init__(self) -> None:
        from app.config import settings
        from sentence_transformers import CrossEncoder

        os.environ["HF_HOME"] = settings.HF_HOME
        logger.info("Loading reranker model: %s", settings.RERANKER_MODEL)
        self.model = CrossEncoder(settings.RERANKER_MODEL)
        logger.info("Reranker model loaded")

    def rerank(
        self,
        query: str,
        passages: list[dict],  # [{"text": "...", "metadata": {...}}]
        top_k: int = 5,
    ) -> list[ScoredPassage]:
        if not passages:
            return []

        pairs = [(query, p["text"]) for p in passages]
        scores = self.model.predict(pairs)

        scored = [
            ScoredPassage(
                text=p["text"],
                score=float(scores[i]),
                original_index=i,
                metadata=p.get("metadata", {}),
            )
            for i, p in enumerate(passages)
        ]
        scored.sort(key=lambda x: x.score, reverse=True)
        return scored[:top_k]
