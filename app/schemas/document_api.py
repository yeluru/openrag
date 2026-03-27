"""OpenAPI-stable document upload / detail / ingestion responses."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    document_id: UUID
    ingestion_job_id: UUID
    status: str


class ParserDescriptor(BaseModel):
    """Registered ingest parser (for clients and contributors)."""

    id: str
    version: str
    canonical_mime: str
    extensions: list[str]


class SupportedFormatsResponse(BaseModel):
    """Formats the API can ingest today; grows as new parsers register."""

    parsers: list[ParserDescriptor]
    canonical_mime_types: list[str]
    extensions: list[str]
    upload_content_types: list[str]


class IngestionJobSummary(BaseModel):
    job_id: UUID
    status: str
    error_message: str | None = None
    progress: dict[str, Any] = Field(default_factory=dict)


class DocumentDetailResponse(BaseModel):
    id: UUID
    title: str
    original_filename: str
    mime_type: str = "application/pdf"
    page_count: int | None = None
    author_inferred: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    ingestion: IngestionJobSummary | None = None
    created_at: datetime


class DocumentStructureResponse(BaseModel):
    document_id: UUID
    sections: list[dict[str, Any]] = Field(default_factory=list)


class IngestionStatusResponse(BaseModel):
    job_id: UUID
    status: str
    error_message: str | None = None
    error_detail: dict[str, Any] | list[Any] | None = None
    progress: dict[str, Any] = Field(default_factory=dict)


class ReadthroughChunkOut(BaseModel):
    chunk_id: UUID
    text: str
    page_start: int | None = None
    page_end: int | None = None
    chapter_label: str | None = None
    section_label: str | None = None


class SectionReadthroughResponse(BaseModel):
    section_id: UUID
    section_label: str | None = None
    chunk_count: int
    chunks: list[ReadthroughChunkOut]


class DocumentReadthroughResponse(BaseModel):
    document_id: UUID
    chunk_count: int
    chunks: list[ReadthroughChunkOut]
