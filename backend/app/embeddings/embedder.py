import asyncio
import hashlib
import logging
import os
import numpy as np

logger = logging.getLogger(__name__)

_embedder_instance = None


def get_embedder():
    global _embedder_instance
    if _embedder_instance is None:
        from app.config import settings
        provider = settings.EMBEDDING_PROVIDER
        try:
            if provider == "ollama":
                _embedder_instance = OllamaEmbedder()
                logger.info("Using OllamaEmbedder: %s", settings.OLLAMA_EMBEDDING_MODEL)
            else:
                _embedder_instance = SentenceTransformerEmbedder()
        except Exception as e:
            if settings.APP_ENV == "production":
                raise RuntimeError(
                    f"Primary embedder failed in production — refusing to use hash fallback "
                    f"(semantic search would be broken): {e}"
                ) from e
            logger.error(
                "PRIMARY EMBEDDER FAILED — falling back to HashFallbackEmbedder. "
                "Semantic search will NOT work correctly. Fix embedding setup before indexing. "
                "Error: %s",
                e,
            )
            _embedder_instance = HashFallbackEmbedder(dim=settings.EMBEDDING_DIM)
    return _embedder_instance


class SentenceTransformerEmbedder:

    def __init__(self) -> None:
        from app.config import settings
        from sentence_transformers import SentenceTransformer

        os.environ["HF_HOME"] = settings.HF_HOME
        logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
        self.model = SentenceTransformer(settings.EMBEDDING_MODEL)
        self.dim = settings.EMBEDDING_DIM
        logger.info("Embedding model loaded, dim=%d", self.dim)

    def encode_passages(self, texts: list[str], batch_size: int = 32) -> np.ndarray:
        prefixed = [f"passage: {t}" for t in texts]
        return self.model.encode(
            prefixed,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
        )

    def encode_query(self, query: str) -> np.ndarray:
        return self.model.encode(
            f"query: {query}",
            show_progress_bar=False,
            normalize_embeddings=True,
        )


class OllamaEmbedder:

    def __init__(self) -> None:
        from app.config import settings

        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_EMBEDDING_MODEL
        self.timeout = settings.OLLAMA_EMBEDDING_TIMEOUT
        self.dim = settings.EMBEDDING_DIM
        self._use_e5_prefixes = settings.OLLAMA_EMBEDDING_USE_E5_PREFIXES

    def _embed_one_sync(self, text: str) -> np.ndarray:
        import httpx
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
            )
        resp.raise_for_status()
        vec = np.array(resp.json()["embedding"], dtype=np.float32)
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    def _encode_passages_sync(self, texts: list[str]) -> np.ndarray:
        return np.stack([self._embed_one_sync(t) for t in texts])

    def encode_query(self, query: str) -> np.ndarray:
        text = f"query: {query}" if self._use_e5_prefixes else query
        return self._embed_one_sync(text)

    def encode_passages(self, texts: list[str], batch_size: int = 32) -> np.ndarray:
        prefixed = [f"passage: {t}" if self._use_e5_prefixes else t for t in texts]
        return self._encode_passages_sync(prefixed)


class HashFallbackEmbedder:
    """SHA-256-based fallback embedder; activated when the primary embedder is unavailable."""

    _CACHE_MAX = 1000

    def __init__(self, dim: int = 1024) -> None:
        self.dim = dim
        self._cache: dict[str, np.ndarray] = {}

    def _hash(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()

    def _text_to_vector(self, text: str) -> np.ndarray:
        key = self._hash(text)
        if key in self._cache:
            return self._cache[key]

        words = [w for w in text.lower().split() if len(w) > 1]
        vector = np.zeros(self.dim, dtype=np.float32)

        for word in words:
            h = self._hash(word)
            dim_idx = int(h[:8], 16) % self.dim
            val = (int(h[8:16], 16) % 1000) / 1000.0 - 0.5
            vector[dim_idx] += val

        text_hash = key
        for i in range(min(64, self.dim)):
            offset = (i * 2) % 56
            part = text_hash[offset: offset + 8] or "0"
            vector[i] += (int(part, 16) % 1000) / 1000.0 - 0.5

        norm = np.linalg.norm(vector)
        if norm > 0:
            vector /= norm

        if len(self._cache) >= self._CACHE_MAX:
            self._cache.pop(next(iter(self._cache)))
        self._cache[key] = vector
        return vector

    def encode_query(self, query: str) -> np.ndarray:
        return self._text_to_vector(query)

    def encode_passages(self, texts: list[str], batch_size: int = 32) -> np.ndarray:
        return np.stack([self._text_to_vector(t) for t in texts])
