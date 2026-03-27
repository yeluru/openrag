"""PyMuPDF-based PDF parser.

Native text is extracted first. When enabled, pages with no embedded text are
run through Tesseract via PyMuPDF (``get_textpage_ocr``). Install Tesseract
and language packs separately — see PyMuPDF OCR docs.

Limitations:
- Complex multi-column layouts may merge reading order incorrectly.
- Font metadata is heuristic; OCR text has no real bold/size semantics.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

import fitz  # PyMuPDF

from app.core.config import get_settings
from app.services.parsing.models import ParsedBlock, ParsedDocument, ParsedPage

logger = logging.getLogger(__name__)


def _clean_line(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _blocks_from_page_dict(page_dict: dict) -> tuple[list[ParsedBlock], list[str]]:
    """Build ParsedBlocks and plain lines from PyMuPDF ``get_text('dict')`` output."""
    blocks_out: list[ParsedBlock] = []
    lines_plain: list[str] = []
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue
            line_text_parts: list[str] = []
            max_size = 0.0
            any_bold = False
            for sp in spans:
                t = sp.get("text", "") or ""
                if t.strip():
                    line_text_parts.append(t)
                sz = float(sp.get("size", 0) or 0)
                max_size = max(max_size, sz)
                font = (sp.get("font") or "").lower()
                flags = int(sp.get("flags", 0) or 0)
                if "bold" in font or (flags & 2**4):
                    any_bold = True
            line_text = "".join(line_text_parts)
            line_text = _clean_line(line_text)
            if not line_text:
                continue
            lines_plain.append(line_text)
            bbox = line.get("bbox")
            bb = None
            if bbox and len(bbox) >= 4:
                bb = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
            blocks_out.append(
                ParsedBlock(
                    text=line_text,
                    bbox=bb,
                    font_size=max_size or None,
                    is_bold=any_bold,
                )
            )
    return blocks_out, lines_plain


class PyMuPDFParser:
    name = "pymupdf"
    version = getattr(fitz, "__version__", "unknown")

    def __init__(
        self,
        *,
        ocr_enabled: bool | None = None,
        ocr_language: str | None = None,
        ocr_dpi: int | None = None,
        ocr_tessdata: str | None = None,
    ) -> None:
        s = get_settings()
        self._ocr_enabled = ocr_enabled if ocr_enabled is not None else s.pdf_ocr_enabled
        self._ocr_language = ocr_language if ocr_language is not None else s.pdf_ocr_language
        self._ocr_dpi = ocr_dpi if ocr_dpi is not None else s.pdf_ocr_dpi
        td = ocr_tessdata if ocr_tessdata is not None else s.pdf_ocr_tessdata
        self._ocr_tessdata: str | None = td.strip() or None

    def parse(self, file_path: str) -> ParsedDocument:
        path = Path(file_path)
        limitations: list[str] = []
        if not path.exists():
            raise FileNotFoundError(file_path)

        doc = fitz.open(file_path)
        ocr_pages: list[int] = []
        try:
            meta = {
                "title": doc.metadata.get("title") or None,
                "author": doc.metadata.get("author") or None,
                "page_count": doc.page_count,
            }
            pages: list[ParsedPage] = []
            for i in range(doc.page_count):
                page = doc.load_page(i)
                page_dict = page.get_text("dict")
                blocks_out, lines_plain = _blocks_from_page_dict(page_dict)
                full_text = "\n".join(lines_plain)
                ocr_failed = False

                if not full_text.strip() and self._ocr_enabled:
                    try:
                        tp = page.get_textpage_ocr(
                            language=self._ocr_language,
                            dpi=self._ocr_dpi,
                            full=True,
                            tessdata=self._ocr_tessdata,
                        )
                        try:
                            ocr_dict = page.get_text("dict", textpage=tp)
                            blocks_out, lines_plain = _blocks_from_page_dict(ocr_dict)
                            full_text = "\n".join(lines_plain)
                            if full_text.strip():
                                ocr_pages.append(i + 1)
                                logger.debug(
                                    "OCR extracted text for page %s (chars=%s)",
                                    i + 1,
                                    len(full_text),
                                )
                        finally:
                            del tp
                    except Exception as e:
                        ocr_failed = True
                        err_short = str(e).replace("\n", " ")[:200]
                        logger.warning(
                            "PDF OCR failed for page %s: %s",
                            i + 1,
                            e,
                            exc_info=logger.isEnabledFor(logging.DEBUG),
                        )
                        limitations.append(
                            f"Page {i + 1}: OCR failed ({type(e).__name__}: {err_short}). "
                            "Install Tesseract-OCR, or set PDF_OCR_ENABLED=false."
                        )

                if not full_text.strip() and not ocr_failed:
                    limitations.append(
                        f"Page {i + 1} has no extractable text (may be scanned)."
                    )

                pages.append(ParsedPage(page_number=i + 1, text=full_text, blocks=blocks_out))
        finally:
            doc.close()

        if ocr_pages:
            meta["ocr_pages"] = ocr_pages
            limitations.insert(
                0,
                f"OCR extracted text on {len(ocr_pages)} page(s); quality depends on scan resolution and language.",
            )

        return ParsedDocument(
            pages=pages,
            file_path=str(path),
            parser_name=self.name,
            parser_version=getattr(fitz, "__version__", self.version),
            limitations=limitations,
            raw_metadata=meta,
        )


def _register() -> None:
    from app.services.parsing.registry import register_parser

    register_parser(
        canonical_mime="application/pdf",
        mime_types=frozenset({"application/pdf"}),
        extensions=frozenset({".pdf"}),
        factory=lambda: PyMuPDFParser(),
    )


_register()
