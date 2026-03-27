"""Parsed document representations (parser-agnostic)."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ParsedBlock:
    """A layout block on a page (optional; used when the parser exposes structure)."""

    text: str
    bbox: tuple[float, float, float, float] | None = None
    font_size: float | None = None
    is_bold: bool = False


@dataclass
class ParsedPage:
    """Single page: full text plus optional structured blocks."""

    page_number: int  # 1-based
    text: str
    blocks: list[ParsedBlock] = field(default_factory=list)


@dataclass
class ParsedDocument:
    """Full document output from a :class:`~app.services.parsing.base.DocumentParser`."""

    pages: list[ParsedPage]
    file_path: str
    parser_name: str
    parser_version: str
    limitations: list[str] = field(default_factory=list)
    raw_metadata: dict[str, Any] = field(default_factory=dict)
