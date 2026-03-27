from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, optional_api_key
from app.core.config import get_settings
from app.db.session import get_db
from app.services.documents.document_service import (
    create_document_with_job,
    get_structure_tree,
    latest_job,
    list_documents,
    resolve_stored_upload_path,
    save_upload,
)
from app.schemas.document_api import (
    DocumentDetailResponse,
    DocumentReadthroughResponse,
    DocumentStructureResponse,
    DocumentUploadResponse,
    IngestionJobSummary,
    IngestionStatusResponse,
    ParserDescriptor,
    ReadthroughChunkOut,
    SectionReadthroughResponse,
    SupportedFormatsResponse,
)
from app.services.documents.section_readthrough import (
    fetch_full_document_readthrough,
    fetch_section_readthrough,
)
from app.services.parsing.registry import (
    canonical_mime_types,
    iter_registrations,
    normalize_upload_mime,
    supported_extensions,
    upload_content_types,
)
from app.workers.ingestion_worker import process_ingestion_job

router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentSummary(BaseModel):
    id: UUID
    title: str
    page_count: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/supported-formats", response_model=SupportedFormatsResponse)
async def document_supported_formats() -> SupportedFormatsResponse:
    """Describe ingestible formats. Public so UIs and integrations can stay in sync with the server."""
    parsers: list[ParserDescriptor] = []
    for reg in iter_registrations():
        instance = reg.factory()
        parsers.append(
            ParserDescriptor(
                id=instance.name,
                version=instance.version,
                canonical_mime=reg.canonical_mime,
                extensions=sorted(reg.extensions),
            )
        )
    return SupportedFormatsResponse(
        parsers=parsers,
        canonical_mime_types=sorted(canonical_mime_types()),
        extensions=sorted(supported_extensions()),
        upload_content_types=sorted(upload_content_types()),
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
    file: UploadFile = File(...),
) -> DocumentUploadResponse:
    settings = get_settings()
    try:
        effective_mime = normalize_upload_mime(file.content_type, file.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    data = await file.read()
    max_b = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_b:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_mb} MB limit")
    default_name = "upload" + (Path(file.filename or "").suffix or ".pdf")
    path, _ = await save_upload(file.filename or default_name, data)
    doc, job = await create_document_with_job(
        db,
        user_id=user_id,
        original_filename=file.filename or default_name,
        storage_path=path,
        mime_type=effective_mime,
    )
    background_tasks.add_task(process_ingestion_job, doc.id, job.id)
    return DocumentUploadResponse(
        document_id=doc.id,
        ingestion_job_id=job.id,
        status=job.status.value,
    )


@router.get("", response_model=list[DocumentSummary])
async def list_user_documents(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> list[DocumentSummary]:
    docs = await list_documents(db, user_id)
    return [DocumentSummary.model_validate(d) for d in docs]


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> DocumentDetailResponse:
    from app.db.models.document import Document

    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    job = await latest_job(db, document_id)
    ingestion: IngestionJobSummary | None = None
    if job:
        ingestion = IngestionJobSummary(
            job_id=job.id,
            status=job.status.value,
            error_message=job.error_message,
            progress=job.progress_meta or {},
        )
    return DocumentDetailResponse(
        id=doc.id,
        title=doc.title,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type or "application/pdf",
        page_count=doc.page_count,
        author_inferred=doc.author_inferred,
        metadata=doc.extra_metadata or {},
        ingestion=ingestion,
        created_at=doc.created_at,
    )


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> FileResponse:
    """Stream the original uploaded file for in-browser viewing (auth via headers)."""
    from app.db.models.document import Document

    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    path = resolve_stored_upload_path(doc.storage_path)
    if path is None:
        raise HTTPException(status_code=404, detail="Original file not found on disk")
    return FileResponse(
        path,
        media_type=doc.mime_type or "application/pdf",
        filename=doc.original_filename or "document",
        content_disposition_type="inline",
    )


@router.get("/{document_id}/readthrough", response_model=DocumentReadthroughResponse)
async def document_readthrough(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> DocumentReadthroughResponse:
    """Return indexed chunk text for the whole document in reading order."""
    pieces = await fetch_full_document_readthrough(
        db, user_id=user_id, document_id=document_id
    )
    if pieces is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentReadthroughResponse(
        document_id=document_id,
        chunk_count=len(pieces),
        chunks=[
            ReadthroughChunkOut(
                chunk_id=p.chunk_id,
                text=p.text,
                page_start=p.page_start,
                page_end=p.page_end,
                chapter_label=p.chapter_label,
                section_label=p.section_label,
            )
            for p in pieces
        ],
    )


@router.get(
    "/{document_id}/sections/{section_id}/readthrough",
    response_model=SectionReadthroughResponse,
)
async def section_readthrough(
    document_id: UUID,
    section_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> SectionReadthroughResponse:
    """Return indexed chunk text for a section and its descendants, in reading order."""
    out = await fetch_section_readthrough(
        db,
        user_id=user_id,
        document_id=document_id,
        section_id=section_id,
    )
    if out is None:
        raise HTTPException(status_code=404, detail="Document or section not found")
    pieces, label = out
    return SectionReadthroughResponse(
        section_id=section_id,
        section_label=label,
        chunk_count=len(pieces),
        chunks=[
            ReadthroughChunkOut(
                chunk_id=p.chunk_id,
                text=p.text,
                page_start=p.page_start,
                page_end=p.page_end,
                chapter_label=p.chapter_label,
                section_label=p.section_label,
            )
            for p in pieces
        ],
    )


@router.get("/{document_id}/structure", response_model=DocumentStructureResponse)
async def document_structure(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> DocumentStructureResponse:
    from app.db.models.document import Document

    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    tree = await get_structure_tree(db, document_id)
    return DocumentStructureResponse(document_id=document_id, sections=tree)


@router.get("/{document_id}/ingestion", response_model=IngestionStatusResponse)
async def ingestion_status(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(current_user_id),
    _: None = Depends(optional_api_key),
) -> IngestionStatusResponse:
    from app.db.models.document import Document

    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    job = await latest_job(db, document_id)
    if not job:
        raise HTTPException(status_code=404, detail="No ingestion job")
    return IngestionStatusResponse(
        job_id=job.id,
        status=job.status.value,
        error_message=job.error_message,
        error_detail=job.error_detail,
        progress=job.progress_meta or {},
    )
