import logging
import os
import numpy as np

logger = logging.getLogger(__name__)

_embedder_instance = None


def get_embedder() -> "SentenceTransformerEmbedder":
    global _embedder_instance
    if _embedder_instance is None:
        _embedder_instance = SentenceTransformerEmbedder()
    return _embedder_instance


class SentenceTransformerEmbedder:
    """
    Singleton wrapper around SentenceTransformer.
    Uses intfloat/multilingual-e5-large for cross-lingual RU+EN support.
    Prefixes queries with 'query: ' and passages with 'passage: ' as required by E5.
    """

    def __init__(self) -> None:
        from app.config import settings
        from sentence_transformers import SentenceTransformer

        os.environ["HF_HOME"] = settings.HF_HOME
        logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
        self.model = SentenceTransformer(settings.EMBEDDING_MODEL)
        self.dim = settings.EMBEDDING_DIM
        logger.info("Embedding model loaded, dim=%d", self.dim)

    def encode_passages(self, texts: list[str], batch_size: int = 32) -> np.ndarray:
        """Encode document passages (with 'passage: ' prefix for E5)."""
        prefixed = [f"passage: {t}" for t in texts]
        return self.model.encode(
            prefixed,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
        )

    def encode_query(self, query: str) -> np.ndarray:
        """Encode a search query (with 'query: ' prefix for E5)."""
        return self.model.encode(
            f"query: {query}",
            show_progress_bar=False,
            normalize_embeddings=True,
        )
