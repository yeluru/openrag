"""Background ingestion runner (own DB session per job)."""

import logging

from app.db.session import AsyncSessionLocal
from app.services.ingestion.pipeline import run_ingestion

logger = logging.getLogger(__name__)


async def process_ingestion_job(document_id, job_id) -> None:
    async with AsyncSessionLocal() as session:
        try:
            await run_ingestion(session, document_id, job_id)
        except Exception:
            logger.exception("Unhandled ingestion error doc=%s job=%s", document_id, job_id)
            raise
