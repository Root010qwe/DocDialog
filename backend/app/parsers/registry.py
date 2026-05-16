from app.parsers.base import ParserFactory
from app.parsers.docx_parser import DocxParser
from app.parsers.docling_parser import DoclingParser
from app.parsers.txt_parser import TxtParser

ParserFactory.register(DocxParser())    # fast path: .docx/.doc via python-docx
ParserFactory.register(DoclingParser()) # heavy path: .pdf/.html via Docling (singleton)
ParserFactory.register(TxtParser())
