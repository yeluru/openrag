"""Best-effort structure inference from parsed PDF pages.

Falls back to page-window *logical* sections when headings are sparse so
chunking and chapter-scoped retrieval still work.
"""

from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field

from app.db.models.enums import SectionKind
from app.services.parsing.models import ParsedDocument, ParsedPage


@dataclass
class InferredSection:
    """One node in the inferred hierarchy (before persisting to DB)."""

    kind: SectionKind
    label: str
    page_start: int
    page_end: int
    order_index: int
    depth: int
    parent_index: int | None
    text: str = ""
    children_indices: list[int] = field(default_factory=list)


@dataclass
class _Heading:
    page: int
    char_offset: int
    label: str
    score: float


_CHAPTER_RE = re.compile(
    r"^(chapter|part)\s+[\dIVXLC]+[.:]?\s*$",
    re.IGNORECASE,
)
_SECTION_NUM_RE = re.compile(r"^\d+(\.\d+)*\s+[A-Z0-9].{0,200}$")
# O'Reilly / common imprint address lines mistaken for headings when bold/large
_PUBLISHER_JUNK = frozenset(
    {
        "boston",
        "farnham",
        "sebastopol",
        "tokyo",
        "beijing",
        "sebastopol",
        "gravenstein",
        "safari",
        "oreilly",
        "o'reilly",
    }
)
_TOC_LINE_RE = re.compile(
    r"^(part\s+[ivx\d]+|chapter\s+\d+|contents|table\s+of\s+contents|preface|index|glossary)\b",
    re.IGNORECASE,
)


def _is_noise_label(label: str) -> bool:
    s = label.strip()
    if len(s) < 4:
        return True
    low = s.lower().rstrip(".")
    if low in _PUBLISHER_JUNK:
        return True
    words = s.split()
    if len(words) == 1 and s.isupper() and len(s) < 24:
        return True
    return False


def _dedupe_heading_sequence(headings: list[_Heading]) -> list[_Heading]:
    out: list[_Heading] = []
    seen: set[str] = set()
    prev_key: str | None = None
    for h in headings:
        lab = h.label.strip()
        if _is_noise_label(lab):
            continue
        key = re.sub(r"\s+", " ", lab.lower())
        if key == prev_key:
            continue
        if key in seen and h.score < 2.5:
            continue
        seen.add(key)
        prev_key = key
        out.append(h)
    return out


def _line_heading_score(
    line: str,
    font_size: float | None,
    median_size: float,
    is_bold: bool,
) -> float:
    s = line.strip()
    if len(s) < 3 or len(s) > 200:
        return 0.0
    score = 0.0
    if _CHAPTER_RE.match(s):
        score += 3.0
    if _SECTION_NUM_RE.match(s):
        score += 2.0
    if s.isupper() and 20 <= len(s) < 80:
        score += 1.0
    elif s.isupper() and len(s) < 20 and len(s.split()) >= 2:
        score += 0.8
    if _TOC_LINE_RE.match(s):
        score += 2.0
    if font_size and median_size > 0 and font_size >= median_size * 1.12:
        score += 1.5
    if is_bold:
        score += 0.5
    if s.endswith(":") and len(s) < 100:
        score += 0.3
    if score > 0 and s.endswith("."):
        score -= 0.5
    return max(0.0, score)


def _collect_font_sizes(pages: list[ParsedPage]) -> list[float]:
    sizes: list[float] = []
    for p in pages:
        for b in p.blocks:
            if b.font_size:
                sizes.append(b.font_size)
    return sizes


def _scan_headings(pages: list[ParsedPage], median_size: float) -> list[_Heading]:
    out: list[_Heading] = []
    for p in pages:
        offset = 0
        for block in p.blocks:
            line = block.text
            sc = _line_heading_score(line, block.font_size, median_size, block.is_bold)
            if sc >= 1.5 and not _is_noise_label(line.strip()):
                out.append(_Heading(p.page_number, offset, line.strip()[:1024], sc))
            offset += len(line) + 1
    out.sort(key=lambda h: (h.page, h.char_offset))
    return out


def _extract_text_for_page_range(pages: list[ParsedPage], start: int, end: int) -> str:
    parts: list[str] = []
    for p in pages:
        if start <= p.page_number <= end:
            parts.append(p.text)
    return "\n\n".join(parts).strip()


def extract_structure(parsed: ParsedDocument) -> list[InferredSection]:
    """Flat list: index 0 is document root; others reference ``parent_index``."""
    pages = parsed.pages
    if not pages:
        return []

    title = parsed.raw_metadata.get("title") or "Document"
    root = InferredSection(
        kind=SectionKind.document_root,
        label=title,
        page_start=1,
        page_end=pages[-1].page_number,
        order_index=0,
        depth=0,
        parent_index=None,
        text="",
    )
    sections: list[InferredSection] = [root]

    sizes = _collect_font_sizes(pages)
    median_size = float(statistics.median(sizes)) if sizes else 12.0
    headings = _dedupe_heading_sequence(_scan_headings(pages, median_size))
    strong = [h for h in headings if h.score >= 2.0]
    use = strong if len(strong) >= 3 else [h for h in headings if h.score >= 1.8]
    use = _dedupe_heading_sequence(use)

    if len(use) < 2:
        return _fallback_page_sections(parsed, sections)

    author_low = (parsed.raw_metadata.get("author") or "").strip().lower()
    title_low = (parsed.raw_metadata.get("title") or "").strip().lower()
    use = [
        h
        for h in use
        if not (
            author_low
            and h.label.strip().lower() == author_low
            or (title_low and h.label.strip().lower() == title_low)
        )
    ]

    if len(use) < 2:
        return _fallback_page_sections(parsed, sections)

    order = 1
    for i, h in enumerate(use):
        start_pg = h.page
        if i + 1 < len(use):
            end_pg = min(use[i + 1].page - 1, pages[-1].page_number)
        else:
            end_pg = pages[-1].page_number
        if end_pg < start_pg:
            end_pg = start_pg
        body = _extract_text_for_page_range(pages, start_pg, end_pg)
        ch = InferredSection(
            kind=SectionKind.chapter,
            label=h.label,
            page_start=start_pg,
            page_end=end_pg,
            order_index=order,
            depth=1,
            parent_index=0,
            text=body,
        )
        root.children_indices.append(len(sections))
        sections.append(ch)
        order += 1

    _attach_subsections(sections, pages, median_size)
    return sections


def _attach_subsections(
    sections: list[InferredSection],
    pages: list[ParsedPage],
    median_size: float,
) -> None:
    """Split chapters into section children when weak headings exist."""
    root = sections[0]
    for ch_idx in list(root.children_indices):
        chapter = sections[ch_idx]
        if chapter.kind not in (SectionKind.chapter, SectionKind.logical):
            continue
        subs = _subsections_for_chapter(chapter, pages, median_size)
        if len(subs) <= 1:
            continue
        chapter.text = ""
        chapter.children_indices = []
        for j, sub in enumerate(subs):
            sub.parent_index = ch_idx
            sub.order_index = j
            sub.depth = chapter.depth + 1
            new_idx = len(sections)
            chapter.children_indices.append(new_idx)
            sections.append(sub)


def _subsections_for_chapter(
    chapter: InferredSection,
    pages: list[ParsedPage],
    median_size: float,
) -> list[InferredSection]:
    sub_pages = [p for p in pages if chapter.page_start <= p.page_number <= chapter.page_end]
    weak: list[_Heading] = []
    for p in sub_pages:
        offset = 0
        for block in p.blocks:
            raw = block.text.strip()
            sc = _line_heading_score(block.text, block.font_size, median_size, block.is_bold)
            if 1.2 <= sc < 2.0 and not _is_noise_label(raw):
                weak.append(_Heading(p.page_number, offset, raw[:1024], sc))
            offset += len(block.text) + 1
    weak.sort(key=lambda h: (h.page, h.char_offset))
    if len(weak) < 2:
        return [chapter]

    out: list[InferredSection] = []
    for i, h in enumerate(weak):
        start_pg = h.page
        if i + 1 < len(weak):
            end_pg = min(weak[i + 1].page - 1, chapter.page_end)
        else:
            end_pg = chapter.page_end
        if end_pg < start_pg:
            end_pg = start_pg
        text = _extract_text_for_page_range(sub_pages, start_pg, end_pg)
        out.append(
            InferredSection(
                kind=SectionKind.section,
                label=h.label,
                page_start=start_pg,
                page_end=end_pg,
                order_index=i,
                depth=chapter.depth + 1,
                parent_index=None,
                text=text,
            )
        )
    return out


def _fallback_page_sections(
    parsed: ParsedDocument,
    sections: list[InferredSection],
) -> list[InferredSection]:
    pages = parsed.pages
    window = 15
    root = sections[0]
    order = 1
    i = 0
    while i < len(pages):
        batch = pages[i : i + window]
        ps = batch[0].page_number
        pe = batch[-1].page_number
        body = "\n\n".join(p.text for p in batch)
        sec = InferredSection(
            kind=SectionKind.logical,
            label=f"Pages {ps}–{pe}",
            page_start=ps,
            page_end=pe,
            order_index=order,
            depth=1,
            parent_index=0,
            text=body,
        )
        root.children_indices.append(len(sections))
        sections.append(sec)
        order += 1
        i += window
    return sections
