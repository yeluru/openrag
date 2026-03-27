"""Use persisted section titles for outline / chapter-list style questions."""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.enums import SectionKind
from app.db.models.section import DocumentSection

SECTION_SUMMARY_RE = re.compile(
    r"\b("
    r"summariz(?:e|es|ed|ing)|summary|sum\s+up|overview|main\s+points|key\s+points|"
    r"gist|tl;dr|what\s+(?:does|do)\s+(?:the\s+)?(?:section|part|chapter)\s+cover|"
    r"in\s+this\s+section|cover(?:s|ing)?\s+(?:in\s+)?(?:this\s+)?(?:section|part)"
    r")\b",
    re.IGNORECASE,
)


def question_asks_section_summary(question: str) -> bool:
    return bool(SECTION_SUMMARY_RE.search(question))


OUTLINE_QUERY_RE = re.compile(
    r"\b("
    r"chapters?|chapter\s+list|table\s+of\s+contents|\btoc\b|outline\b|contents\b|structure\b|"
    r"sections?\s+of|what\s+are\s+the\s+(key\s+|main\s+)?(chapters|parts)|"
    r"list\s+(the\s+)?chapters|book\s+outline|organization\s+of\s+the\s+book|"
    r"parts?\s+of\s+the\s+book|how\s+is\s+the\s+book\s+organized"
    r")\b",
    re.IGNORECASE,
)


def question_asks_document_outline(question: str) -> bool:
    return bool(OUTLINE_QUERY_RE.search(question))


async def build_document_outline_text(
    db: AsyncSession,
    document_id: UUID,
    *,
    max_lines: int = 400,
) -> str | None:
    res = await db.execute(
        select(DocumentSection)
        .where(DocumentSection.document_id == document_id)
        .where(DocumentSection.kind != SectionKind.document_root)
        .order_by(
            DocumentSection.page_start.nulls_last(),
            DocumentSection.depth,
            DocumentSection.order_index,
        )
    )
    rows = list(res.scalars().all())
    if not rows:
        return None
    lines: list[str] = []
    for r in rows:
        lab = (r.label or "").strip()
        if len(lab) < 2:
            continue
        ind = "  " * max(0, min(r.depth - 1, 8))
        lines.append(f"{ind}• {lab}")
        if len(lines) >= max_lines:
            break
    if not lines:
        return None
    return "\n".join(lines)
