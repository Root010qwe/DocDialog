from pathlib import Path
from app.parsers.base import AbstractParser, ParsedDocument

TXT_TYPES = {"text/plain", "text/markdown", "text/x-markdown"}
TXT_EXTENSIONS = {".txt", ".md", ".markdown", ".rst"}


class TxtParser(AbstractParser):
    def can_handle(self, content_type: str, filename: str) -> bool:
        ext = Path(filename).suffix.lower()
        return content_type in TXT_TYPES or ext in TXT_EXTENSIONS

    def parse(self, file_path: str, filename: str) -> ParsedDocument:
        title = Path(filename).stem
        with open(file_path, encoding="utf-8", errors="ignore") as f:
            text = f.read()
        return ParsedDocument(text=text, title=title)
