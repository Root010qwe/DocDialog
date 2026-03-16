from dataclasses import dataclass


@dataclass
class TextChunk:
    text: str
    chunk_index: int
    token_count: int = 0


class RecursiveChunker:
    """
    Splits text recursively by paragraphs → sentences → characters.
    Targets ~512 tokens with ~50 token overlap.
    Uses character-based approximation: 1 token ≈ 4 chars.
    """

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        chars_per_token: float = 4.0,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.max_chars = int(chunk_size * chars_per_token)
        self.overlap_chars = int(chunk_overlap * chars_per_token)
        self._separators = ["\n\n", "\n", ". ", " ", ""]

    def chunk(self, text: str) -> list[TextChunk]:
        raw_chunks = self._split(text, self._separators)
        result = []
        for i, chunk_text in enumerate(raw_chunks):
            text_stripped = chunk_text.strip()
            if not text_stripped:
                continue
            result.append(
                TextChunk(
                    text=text_stripped,
                    chunk_index=i,
                    token_count=len(text_stripped) // 4,
                )
            )
        # Re-index after filtering empty chunks
        for i, chunk in enumerate(result):
            chunk.chunk_index = i
        return result

    def _split(self, text: str, separators: list[str]) -> list[str]:
        if len(text) <= self.max_chars:
            return [text]

        separator = separators[0] if separators else ""
        remaining_separators = separators[1:] if len(separators) > 1 else []

        parts = text.split(separator) if separator else list(text)
        chunks: list[str] = []
        current = ""

        for part in parts:
            candidate = (current + separator + part) if current else part
            if len(candidate) <= self.max_chars:
                current = candidate
            else:
                if current:
                    if len(current) > self.max_chars and remaining_separators:
                        chunks.extend(self._split(current, remaining_separators))
                    else:
                        chunks.append(current)
                    # Overlap: carry over last overlap_chars from current
                    overlap_text = current[-self.overlap_chars:] if self.overlap_chars else ""
                    current = (overlap_text + separator + part).strip() if overlap_text else part
                else:
                    if len(part) > self.max_chars and remaining_separators:
                        chunks.extend(self._split(part, remaining_separators))
                    else:
                        current = part

        if current:
            if len(current) > self.max_chars and remaining_separators:
                chunks.extend(self._split(current, remaining_separators))
            else:
                chunks.append(current)

        return chunks
