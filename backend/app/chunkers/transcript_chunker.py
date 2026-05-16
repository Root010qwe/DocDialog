import re
from app.chunkers.recursive_chunker import TextChunk


# Matches speaker labels like [Говорящий 1], [Speaker 2], [SPEAKER_00], etc.
_SPEAKER_RE = re.compile(r"^\[.{1,40}\]\s*$", re.MULTILINE)


def is_transcript(text: str) -> bool:
    matches = _SPEAKER_RE.findall(text[:4000])
    return len(matches) >= 3


class TranscriptChunker:
    """Groups speaker-labelled turns into overlapping chunks so Q&A pairs stay together."""

    def __init__(self, turns_per_chunk: int = 3, overlap_turns: int = 1) -> None:
        self.turns_per_chunk = turns_per_chunk
        self.overlap_turns = overlap_turns

    def _parse_turns(self, text: str) -> list[tuple[str, str]]:
        parts = _SPEAKER_RE.split(text)
        labels = _SPEAKER_RE.findall(text)

        turns: list[tuple[str, str]] = []

        # Text before the first speaker label (preamble / title)
        preamble = parts[0].strip()
        if preamble:
            turns.append(("[Заголовок]", preamble))

        for label, body in zip(labels, parts[1:]):
            utterance = body.strip()
            if utterance:
                turns.append((label.strip(), utterance))

        return turns

    def chunk(self, text: str) -> list[TextChunk]:
        turns = self._parse_turns(text)
        if not turns:
            return []

        chunks: list[TextChunk] = []
        step = max(1, self.turns_per_chunk - self.overlap_turns)
        i = 0
        chunk_idx = 0

        while i < len(turns):
            window = turns[i: i + self.turns_per_chunk]
            chunk_text = "\n\n".join(
                f"{label}\n{body}" for label, body in window
            ).strip()
            if chunk_text:
                chunks.append(
                    TextChunk(
                        text=chunk_text,
                        chunk_index=chunk_idx,
                        token_count=len(chunk_text) // 4,
                    )
                )
                chunk_idx += 1
            i += step

        return chunks
