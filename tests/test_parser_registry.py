"""Parser registry and upload MIME normalization."""

import pytest

from app.services.parsing.registry import (
    normalize_upload_mime,
    resolve_parser_for_document,
    supported_extensions,
    upload_content_types,
)


def test_normalize_pdf_by_mime() -> None:
    assert normalize_upload_mime("application/pdf", "x.pdf") == "application/pdf"


def test_normalize_pdf_octet_stream_with_extension() -> None:
    assert normalize_upload_mime("application/octet-stream", "book.PDF") == "application/pdf"


def test_normalize_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="Unsupported"):
        normalize_upload_mime("text/plain", "readme.txt")
    with pytest.raises(ValueError, match="Unsupported"):
        normalize_upload_mime("application/octet-stream", "unknown.bin")


def test_normalize_docx_by_mime() -> None:
    assert (
        normalize_upload_mime(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "a.docx",
        )
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


def test_normalize_docx_octet_stream() -> None:
    assert (
        normalize_upload_mime("application/octet-stream", "report.DOCX")
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


def test_normalize_xlsx_by_mime() -> None:
    assert (
        normalize_upload_mime(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "a.xlsx",
        )
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


def test_normalize_xlsx_octet_stream() -> None:
    assert (
        normalize_upload_mime("application/octet-stream", "data.xlsx")
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


def test_resolve_parser_for_document() -> None:
    p = resolve_parser_for_document(mime_type="application/pdf", original_filename="a.pdf")
    assert p.name == "pymupdf"


def test_resolve_docx_parser() -> None:
    p = resolve_parser_for_document(
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        original_filename="a.docx",
    )
    assert p.name == "python-docx"


def test_resolve_xlsx_parser() -> None:
    p = resolve_parser_for_document(
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        original_filename="a.xlsx",
    )
    assert p.name == "openpyxl"


def test_supported_sets_non_empty() -> None:
    exts = supported_extensions()
    assert ".pdf" in exts
    assert ".docx" in exts
    assert ".xlsx" in exts
    assert "application/pdf" in upload_content_types()
    assert "application/octet-stream" in upload_content_types()
