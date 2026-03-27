"""Pluggable document parsers — register new file types without changing the API surface.

To add support for a format:

1. Implement :class:`app.services.parsing.base.DocumentParser`.
2. Call :func:`register_parser` with ``canonical_mime``, ``mime_types``, ``extensions``, and a ``factory``.
3. Import the module from :func:`ensure_parsers_loaded` (or rely on ``pymupdf_parser`` being loaded first).

Built-in parsers are registered when their modules are imported (see ``_ensure_builtins``).
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.parsing.base import DocumentParser


@dataclass(frozen=True)
class ParserRegistration:
    """One ingestible format → parser implementation."""

    canonical_mime: str
    """Stored on :class:`~app.db.models.document.Document` and used to resolve the parser."""
    mime_types: frozenset[str]
    """MIME types accepted directly on upload (lowercase)."""
    extensions: frozenset[str]
    """Filename suffixes, lowercase with leading dot (e.g. ``.pdf``)."""
    factory: Callable[[], DocumentParser]


_REGISTRATIONS: list[ParserRegistration] = []
_BUILTINS_LOADED = False


def register_parser(
    *,
    canonical_mime: str,
    mime_types: frozenset[str],
    extensions: frozenset[str],
    factory: Callable[[], DocumentParser],
) -> ParserRegistration:
    """Register a parser (typically called at module import time)."""
    cm = canonical_mime.strip().lower()
    reg = ParserRegistration(
        canonical_mime=cm,
        mime_types=frozenset(m.strip().lower() for m in mime_types),
        extensions=frozenset(e if e.startswith(".") else f".{e}" for e in extensions),
        factory=factory,
    )
    for existing in _REGISTRATIONS:
        if existing.canonical_mime == reg.canonical_mime:
            raise ValueError(f"Duplicate parser registration for canonical_mime={cm!r}")
    _REGISTRATIONS.append(reg)
    return reg


def _ensure_builtins() -> None:
    global _BUILTINS_LOADED
    if _BUILTINS_LOADED:
        return
    from app.services.parsing import office_parser  # noqa: F401 — .docx / .xlsx
    from app.services.parsing import pymupdf_parser  # noqa: F401 — .pdf

    _BUILTINS_LOADED = True


def ensure_parsers_loaded() -> None:
    """Load built-in parser modules (idempotent). Call from tests or workers if needed."""
    _ensure_builtins()


def iter_registrations() -> Sequence[ParserRegistration]:
    _ensure_builtins()
    return tuple(_REGISTRATIONS)


def normalize_upload_mime(content_type: str | None, filename: str) -> str:
    """Return canonical MIME for storage. Raises ``ValueError`` if the upload is not supported."""
    _ensure_builtins()
    raw = (content_type or "").strip().lower()
    ct = raw or "application/octet-stream"
    ext = Path(filename or "").suffix.lower()

    if ct == "application/octet-stream":
        for reg in _REGISTRATIONS:
            if ext in reg.extensions:
                return reg.canonical_mime
        exts = sorted({e for r in _REGISTRATIONS for e in r.extensions})
        raise ValueError(
            "Unsupported file type for generic binary upload (application/octet-stream). "
            f"Use a known extension. Supported: {', '.join(exts) or '(none)'}"
        )

    for reg in _REGISTRATIONS:
        if ct in reg.mime_types:
            return reg.canonical_mime

    if ext:
        for reg in _REGISTRATIONS:
            if ext in reg.extensions:
                return reg.canonical_mime

    mimes = sorted({m for r in _REGISTRATIONS for m in r.mime_types})
    exts = sorted({e for r in _REGISTRATIONS for e in r.extensions})
    raise ValueError(
        f"Unsupported file type (content-type={content_type!r}). "
        f"Supported MIME types: {', '.join(mimes)}. "
        f"Or use application/octet-stream with extension: {', '.join(exts)}."
    )


def resolve_parser_for_document(*, mime_type: str, original_filename: str):
    """Instantiate the parser for a stored document."""
    _ensure_builtins()
    mime = (mime_type or "").strip().lower()
    ext = Path(original_filename or "").suffix.lower()

    for reg in _REGISTRATIONS:
        if reg.canonical_mime == mime:
            return reg.factory()

    for reg in _REGISTRATIONS:
        if ext in reg.extensions:
            return reg.factory()

    raise LookupError(
        f"No parser registered for mime_type={mime_type!r} "
        f"original_filename={original_filename!r}"
    )


def upload_content_types() -> frozenset[str]:
    """All ``Content-Type`` values the upload endpoint may accept."""
    _ensure_builtins()
    direct: set[str] = set()
    for reg in _REGISTRATIONS:
        direct |= set(reg.mime_types)
    direct.add("application/octet-stream")
    return frozenset(direct)


def supported_extensions() -> frozenset[str]:
    _ensure_builtins()
    return frozenset(e for r in _REGISTRATIONS for e in r.extensions)


def canonical_mime_types() -> frozenset[str]:
    _ensure_builtins()
    return frozenset(r.canonical_mime for r in _REGISTRATIONS)
