"""System / user prompts for grounded QA."""

from app.rag.retrievers.schemas import RetrievedPassage
from app.services.retrieval.outline_hints import question_asks_section_summary


def build_grounded_messages(
    question: str,
    passages: list[RetrievedPassage],
    *,
    mode: str,
    insufficient_evidence: bool,
    document_outline: str | None = None,
    section_scope: bool = False,
) -> list[dict[str, str]]:
    ctx_lines: list[str] = []
    for i, p in enumerate(passages, start=1):
        meta = f"(source #{i}, pages {p.page_start or '?'}-{p.page_end or '?'}, chunk {p.chunk_id})"
        ctx_lines.append(f"{meta}\n{p.text}")

    context_block = "\n\n---\n\n".join(ctx_lines) if ctx_lines else "(no passages)"

    outline_block = ""
    if document_outline and document_outline.strip():
        outline_block = (
            "\n\nDOCUMENT OUTLINE (extracted section titles; use for chapter / TOC / structure questions):\n"
            f"{document_outline.strip()}\n"
        )

    style = {
        "beginner_explanation": "Explain simply for a beginner using short sentences and examples from the text only.",
        "concise_summary": "Be concise; bullet points allowed if helpful.",
        "deep_explanation": "Provide a thorough explanation with nuance, still only from the text.",
        "interview_prep": "Frame as interview-style Q&A: crisp claims you could say aloud, tied to sources.",
        "concept_comparison": "Compare or contrast concepts mentioned in the question using only the text.",
    }.get(mode, "Answer clearly using only the provided sources.")

    sys = f"""You are OpenRAG, a careful reading assistant.
Primary evidence: SOURCE PASSAGES (numbered #1, #2, …). Cite those numbers for detailed claims.
If a DOCUMENT OUTLINE block is present, you may use it for high-level questions about chapters, parts,
or how the book is organized. Do not invent chapters that appear in neither the outline nor the passages.
When several passages contain body text (not only headings), synthesize them into a clear, useful answer—
especially for summarize or explain requests—rather than apologizing that detail is missing.
If evidence is missing, say so clearly.
Style: {style}
End with a brief "Sources used:" line listing source numbers (and note "outline" if you relied on DOCUMENT OUTLINE)."""

    scope_hint = ""
    if section_scope and passages:
        scope_hint = (
            "\n\nREADER SCOPE: Search is limited to one part of the book (this section and its subsections). "
            "Use every numbered passage above that carries substantive prose; weave definitions, examples, "
            "and arguments from the text into one coherent answer."
        )
        if question_asks_section_summary(question) or len(passages) >= 4:
            scope_hint += (
                " Lead with the main themes, then supporting points. Do not treat titles or TOC lines as a "
                "substitute for body text when excerpts above include explanations."
            )

    if insufficient_evidence:
        user = f"""QUESTION:\n{question}\n\nSOURCE PASSAGES:\n{context_block}{outline_block}{scope_hint}\n
The retrieval system flagged weak or missing evidence. Reply honestly: explain what is missing,
summarize what (if anything) the passages and outline do say, and avoid speculation."""
    else:
        user = f"""QUESTION:\n{question}\n\nSOURCE PASSAGES:\n{context_block}{outline_block}{scope_hint}"""

    return [
        {"role": "system", "content": sys},
        {"role": "user", "content": user},
    ]
