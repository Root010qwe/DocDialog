import logging
from pathlib import Path
from typing import Optional

from app.parsers.base import AbstractParser, ParsedDocument

logger = logging.getLogger(__name__)

DOCLING_TYPES = {
    "application/pdf",
    "text/html",
    "application/xhtml+xml",
}

DOCLING_EXTENSIONS = {".pdf", ".html", ".htm"}

# Singleton — loaded once, reused for every document
_converter: Optional[object] = None


def _get_converter():
    global _converter
    if _converter is None:
        from docling.document_converter import DocumentConverter
        logger.info("Loading Docling DocumentConverter (one-time)...")
        _converter = DocumentConverter()
        logger.info("Docling DocumentConverter ready.")
    return _converter


class DoclingParser(AbstractParser):

    def can_handle(self, content_type: str, filename: str) -> bool:
        ext = Path(filename).suffix.lower()
        return content_type in DOCLING_TYPES or ext in DOCLING_EXTENSIONS

    def parse(self, file_path: str, filename: str) -> ParsedDocument:
        try:
            converter = _get_converter()
            result = converter.convert(file_path)
            doc = result.document
            text = doc.export_to_markdown()
            title = Path(filename).stem
            return ParsedDocument(text=text, title=title)

        except Exception as e:
            logger.warning("Docling failed for %s: %s — falling back", filename, e)
            return self._fallback(file_path, filename)

    def _fallback(self, file_path: str, filename: str) -> ParsedDocument:
        ext = Path(filename).suffix.lower()
        title = Path(filename).stem
        try:
            if ext == ".pdf":
                import pdfplumber
                texts = []
                with pdfplumber.open(file_path) as pdf:
                    for page in pdf.pages:
                        t = page.extract_text()
                        if t:
                            texts.append(t)
                return ParsedDocument(text="\n\n".join(texts), title=title)

            elif ext in (".html", ".htm"):
                from bs4 import BeautifulSoup
                with open(file_path, encoding="utf-8", errors="ignore") as f:
                    soup = BeautifulSoup(f.read(), "lxml")
                return ParsedDocument(text=soup.get_text(separator="\n"), title=title)

        except Exception as e2:
            logger.error("Fallback parser also failed for %s: %s", filename, e2)

        return ParsedDocument(text="", title=title)
