"""Structure-aware chunking with overlap and paragraph boundaries."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.db.models.enums import SectionKind
from app.services.ingestion.structure_extractor import InferredSection
from app.utils.text import estimate_tokens, normalize_whitespace


@dataclass
class ChunkDraft:
    """In-memory chunk before persistence."""

    text: str
    normalized_text: str
    page_start: int | None
    page_end: int | None
    chunk_index: int
    chapter_label: str | None
    section_label: str | None
    inferred_section_index: int
    char_start: int | None = None
    char_end: int | None = None
    token_count_estimate: int = 0


def _split_hard(text: str, max_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    out: list[str] = []
    buf = ""
    for s in sentences:
        if len(buf) + len(s) + 1 <= max_chars:
            buf = f"{buf} {s}".strip()
        else:
            if buf:
                out.append(buf)
            if len(s) <= max_chars:
                buf = s
            else:
                for i in range(0, len(s), max_chars):
                    out.append(s[i : i + max_chars])
                buf = ""
    if buf:
        out.append(buf)
    return out


def chunk_section_text(
    text: str,
    *,
    max_chars: int = 2000,
    overlap_chars: int = 200,
    page_start: int | None = None,
    page_end: int | None = None,
    chapter_label: str | None = None,
    section_label: str | None = None,
    inferred_section_index: int = 0,
    start_index: int = 0,
) -> list[ChunkDraft]:
    """Split on blank lines; enforce ``max_chars`` with overlap between chunks."""
    text = text.strip()
    if not text:
        return []

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    pieces: list[str] = []
    for p in paragraphs:
        pieces.extend(_split_hard(p, max_chars))

    drafts: list[ChunkDraft] = []
    buf_parts: list[str] = []
    buf_len = 0
    idx = start_index

    def emit(content: str) -> None:
        nonlocal idx
        if not content.strip():
            return
        norm = normalize_whitespace(content)
        drafts.append(
            ChunkDraft(
                text=content.strip(),
                normalized_text=norm,
                page_start=page_start,
                page_end=page_end,
                chunk_index=idx,
                chapter_label=chapter_label,
                section_label=section_label,
                inferred_section_index=inferred_section_index,
                token_count_estimate=estimate_tokens(norm),
            )
        )
        idx += 1

    carry = ""
    for p in pieces:
        candidate = "\n\n".join([carry, p]).strip() if carry else p
        if len(candidate) <= max_chars:
            carry = candidate
            continue
        if carry:
            emit(carry)
            tail = carry[-overlap_chars:] if overlap_chars and len(carry) > overlap_chars else ""
            carry = f"{tail}\n\n{p}".strip() if tail else p
            if len(carry) > max_chars:
                for chunk in _split_hard(carry, max_chars):
                    emit(chunk)
                    if overlap_chars and len(chunk) > overlap_chars:
                        carry = chunk[-overlap_chars:] + "\n\n"
                    else:
                        carry = ""
                carry = carry.strip()
        else:
            for chunk in _split_hard(p, max_chars):
                emit(chunk)
            carry = ""

    if carry:
        for chunk in _split_hard(carry, max_chars):
            emit(chunk)

    return drafts


def build_chunks_from_structure(
    sections: list[InferredSection],
    *,
    max_chars: int = 2000,
    overlap_chars: int = 200,
) -> list[ChunkDraft]:
    """DFS leaves: chunk each leaf section's text with inherited labels."""
    if not sections:
        return []

    all_drafts: list[ChunkDraft] = []
    counter = 0

    def dfs(idx: int, chapter_label: str | None, section_label: str | None) -> None:
        nonlocal counter
        sec = sections[idx]
        ch_lab = chapter_label
        sec_lab = section_label
        if sec.kind == SectionKind.chapter:
            ch_lab = sec.label
        elif sec.kind == SectionKind.section:
            sec_lab = sec.label
        if sec.children_indices:
            for c in sec.children_indices:
                dfs(c, ch_lab, sec_lab)
            return
        body = sec.text.strip()
        if not body:
            return
        part = chunk_section_text(
            body,
            max_chars=max_chars,
            overlap_chars=overlap_chars,
            page_start=sec.page_start,
            page_end=sec.page_end,
            chapter_label=ch_lab,
            section_label=sec_lab,
            inferred_section_index=idx,
            start_index=counter,
        )
        counter += len(part)
        all_drafts.extend(part)

    root = sections[0]
    for c in root.children_indices:
        dfs(c, None, None)

    for i, d in enumerate(all_drafts):
        d.chunk_index = i

    return all_drafts
