from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ParsedDocument:
    text: str
    title: str = ""
    language: str | None = None
    pages: list[dict] = field(default_factory=list)
    # pages: [{"page_number": 1, "text": "...", "sections": [...]}]


class AbstractParser(ABC):
    @abstractmethod
    def can_handle(self, content_type: str, filename: str) -> bool: ...

    @abstractmethod
    def parse(self, file_path: str, filename: str) -> ParsedDocument: ...


class ParserFactory:
    _parsers: list["AbstractParser"] = []

    @classmethod
    def register(cls, parser: "AbstractParser") -> None:
        cls._parsers.append(parser)

    @classmethod
    def get(cls, content_type: str, filename: str) -> "AbstractParser":
        for parser in cls._parsers:
            if parser.can_handle(content_type, filename):
                return parser
        raise ValueError(f"No parser found for content_type={content_type}, filename={filename}")
