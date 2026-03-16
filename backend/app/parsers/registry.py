"""Register all parsers in the correct priority order."""
from app.parsers.base import ParserFactory
from app.parsers.docling_parser import DoclingParser
from app.parsers.txt_parser import TxtParser

ParserFactory.register(DoclingParser())
ParserFactory.register(TxtParser())
