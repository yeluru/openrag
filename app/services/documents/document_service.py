"""Document CRUD and upload handling."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings, project_root
from app.db.models.document import Document
from app.db.models.enums import IngestionStatus
from app.db.models.ingestion import IngestionJob
from app.db.models.section import DocumentSection
from app.db.models.user import User


async def ensure_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    """Create the user row if missing (idempotent under concurrent requests).

    Two parallel calls used to race: both ``get`` saw no row, both ``INSERT`` → duplicate key.
    ``ON CONFLICT DO NOTHING`` lets the second request succeed after re-fetching.
    """
    u = await db.get(User, user_id)
    if u:
        return u
    now = datetime.now(UTC)
    await db.execute(
        pg_insert(User)
        .values(
            id=user_id,
            email=None,
            display_name=None,
            created_at=now,
            updated_at=now,
        )
        .on_conflict_do_nothing(index_elements=["id"]),
    )
    u = await db.get(User, user_id)
    if u is None:
        raise RuntimeError(f"ensure_user: user {user_id} missing after insert")
    return u


def resolve_stored_upload_path(storage_path: str) -> Path | None:
    """Locate the uploaded file on disk.

    Handles absolute paths, CWD-relative legacy rows, and the common case where
    ``storage_path`` is ``<upload_dir>/<uuid>.<ext>`` as a relative string (must not
    be joined again with ``upload_dir``).
    """
    settings = get_settings()
    root = settings.upload_dir_path
    raw = Path(storage_path)
    candidates: list[Path] = []

    if raw.is_absolute():
        candidates.append(raw)

    candidates.append(root / raw.name)
    candidates.append(Path.cwd() / raw)
    candidates.append(project_root() / raw)
    try:
        candidates.append(raw.resolve())
    except OSError:
        pass

    seen: set[str] = set()
    for c in candidates:
        try:
            resolved = c.resolve()
        except (OSError, RuntimeError):
            continue
        key = str(resolved)
        if key in seen:
            continue
        seen.add(key)
        if resolved.is_file():
            return resolved
    return None


async def save_upload(file_name: str, data: bytes) -> tuple[str, str]:
    settings = get_settings()
    upload_root = settings.upload_dir_path
    upload_root.mkdir(parents=True, exist_ok=True)
    ext = Path(file_name).suffix.lower() or ".pdf"
    uid = uuid.uuid4()
    safe_name = f"{uid}{ext}"
    path = (upload_root / safe_name).resolve()
    path.write_bytes(data)
    return str(path), safe_name


async def create_document_with_job(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    original_filename: str,
    storage_path: str,
    mime_type: str,
) -> tuple[Document, IngestionJob]:
    await ensure_user(db, user_id)
    doc = Document(
        user_id=user_id,
        title=Path(original_filename).stem[:512],
        original_filename=original_filename[:1024],
        storage_path=storage_path,
        mime_type=mime_type,
        extra_metadata={},
    )
    db.add(doc)
    await db.flush()
    job = IngestionJob(
        document_id=doc.id,
        status=IngestionStatus.uploaded,
        progress_meta={},
    )
    db.add(job)
    await db.flush()
    return doc, job


async def list_documents(db: AsyncSession, user_id: uuid.UUID) -> list[Document]:
    res = await db.execute(
        select(Document).where(Document.user_id == user_id).order_by(Document.created_at.desc())
    )
    return list(res.scalars().all())


def section_to_tree(sec: DocumentSection, by_parent: dict) -> dict:
    children = by_parent.get(sec.id, [])
    return {
        "id": str(sec.id),
        "kind": sec.kind.value,
        "label": sec.label,
        "order_index": sec.order_index,
        "page_start": sec.page_start,
        "page_end": sec.page_end,
        "children": [section_to_tree(c, by_parent) for c in sorted(children, key=lambda x: x.order_index)],
    }


async def get_structure_tree(db: AsyncSession, document_id: uuid.UUID) -> list[dict]:
    res = await db.execute(select(DocumentSection).where(DocumentSection.document_id == document_id))
    rows = list(res.scalars().all())
    by_parent: dict[uuid.UUID | None, list[DocumentSection]] = {}
    for s in rows:
        by_parent.setdefault(s.parent_id, []).append(s)
    roots = by_parent.get(None, [])
    return [section_to_tree(r, by_parent) for r in sorted(roots, key=lambda x: x.order_index)]


async def latest_job(db: AsyncSession, document_id: uuid.UUID) -> IngestionJob | None:
    res = await db.execute(
        select(IngestionJob)
        .where(IngestionJob.document_id == document_id)
        .order_by(IngestionJob.created_at.desc())
        .limit(1)
    )
    return res.scalars().first()
