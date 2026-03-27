"""Document parser abstraction — swap implementations without touching ingestion."""

from typing import Protocol, TypeAlias, runtime_checkable

from app.services.parsing.models import ParsedDocument


@runtime_checkable
class DocumentParser(Protocol):
    """Extract text and optional layout from a file on disk."""

    name: str
    version: str

    def parse(self, file_path: str) -> ParsedDocument:
        """Parse file at ``file_path``. Must not mutate the file."""
        ...


# Backwards-compatible alias (PDF-only era).
PDFParser: TypeAlias = DocumentParser
