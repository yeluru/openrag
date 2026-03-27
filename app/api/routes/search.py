from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, optional_api_key
from app.db.models.document import Document
from app.db.models.enums import LearningActivityType
from app.db.session import get_db
from app.services.activity.service import log_learning_activity
from app.rag.citations.package import passages_to_citations
from app.schemas.scope import ScopePayload
from app.services.retrieval.pgvector_retriever import retrieve_passages
from app.schemas.search import SemanticSearchResponse
from app.services.retrieval.scope import RetrievalScope


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    scope: ScopePayload
    top_k: int = Field(default=10, ge=1, le=50)
    min_score: float | None = Field(default=None, ge=0.0, le=1.0)


router = APIRouter(prefix="/search", tags=["search"])


@router.post("/semantic", response_model=SemanticSearchResponse)
async def semantic_search(
    body: SearchRequest,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> SemanticSearchResponse:
    doc = await db.get(Document, body.scope.document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    scope = RetrievalScope(
        document_id=body.scope.document_id,
        section_id=body.scope.section_id,
        chapter_label=body.scope.chapter_label,
        section_label=body.scope.section_label,
        page_start=body.scope.page_start,
        page_end=body.scope.page_end,
    )
    passages, meta = await retrieve_passages(
        db,
        body.query,
        scope,
        top_k=body.top_k,
        min_score=body.min_score if body.min_score is not None else 0.0,
        chapter_id=body.scope.chapter_id,
    )
    await log_learning_activity(
        db,
        user_id,
        LearningActivityType.search,
        meta={"document_id": str(body.scope.document_id), "query_len": len(body.query)},
    )
    return SemanticSearchResponse(
        results=passages,
        citations=passages_to_citations(passages),
        retrieval_meta=meta,
    )
