"""Application configuration from environment."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

# app/core/config.py -> repository root (always load this .env, not CWD-relative)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


def _normalize_database_urls(raw: str) -> tuple[str, str]:
    """Build SQLAlchemy async (asyncpg) and sync (psycopg2) URLs from a standard Postgres URL."""
    u = raw.strip()
    if u.startswith("postgres://"):
        u = "postgresql://" + u[len("postgres://") :]
    if not u.startswith("postgresql://"):
        raise ValueError("DATABASE_URL must start with postgres:// or postgresql://")
    rest = u[len("postgresql://") :]
    return f"postgresql+asyncpg://{rest}", f"postgresql+psycopg2://{rest}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "OpenRAG"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # When set (e.g. Render Postgres "Internal Database URL"), overrides POSTGRES_* below.
    database_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_URL"),
    )

    # PostgreSQL (async) — used only if DATABASE_URL is unset
    postgres_user: str = "openrag"
    postgres_password: str = "openrag"
    postgres_host: str = "localhost"
    # Default matches docker-compose.yml host mapping (5433); override with POSTGRES_PORT=5432 for local Postgres
    postgres_port: int = 5433
    postgres_db: str = "openrag"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            async_url, _ = _normalize_database_urls(self.database_url)
            return async_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sqlalchemy_database_url_sync(self) -> str:
        if self.database_url:
            _, sync_url = _normalize_database_urls(self.database_url)
            return sync_url
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # Uploads (relative paths are under the repository root, not process CWD)
    upload_dir: str = "./data/uploads"
    max_upload_mb: int = 100

    @computed_field  # type: ignore[prop-decorator]
    @property
    def upload_dir_path(self) -> Path:
        p = Path(self.upload_dir)
        if p.is_absolute():
            return p.expanduser().resolve()
        return (_PROJECT_ROOT / p).resolve()

    # PDF parsing — OCR for scanned / image-only pages (requires Tesseract-OCR on PATH)
    pdf_ocr_enabled: bool = True
    pdf_ocr_language: str = "eng"
    pdf_ocr_dpi: int = 200
    pdf_ocr_tessdata: str = Field(
        default="",
        description="Optional path to Tesseract tessdata; empty uses PyMuPDF default discovery",
    )

    # Embeddings (OpenAI-compatible by default; swappable)
    embedding_provider: Literal["openai", "mock"] = "openai"
    embedding_api_base: str = "https://api.openai.com/v1"
    embedding_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    embedding_batch_size: int = 64
    embedding_max_retries: int = 3

    # LLM (OpenAI-compatible chat completions)
    llm_provider: Literal["openai", "mock"] = "openai"
    llm_api_base: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_max_tokens: int = 4096
    llm_temperature: float = 0.2

    # Retrieval
    retrieval_default_top_k: int = 8
    retrieval_min_score_cosine: float = 0.25
    retrieval_dedupe_overlap_ratio: float = 0.85

    # Simple API gate (optional)
    service_api_key: str = ""

    # Observability
    log_json: bool = False
    include_retrieval_debug: bool = Field(default=False, description="Extra retrieval fields when debug=true")

    # CORS (comma-separated origins; empty disables middleware). Render: CORS_ORIGINS.
    cors_origins: str = Field(
        default="",
        validation_alias=AliasChoices("CORS_ORIGINS", "cors_origins"),
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def project_root() -> Path:
    """Repository root (same directory as the loaded `.env`)."""
    return _PROJECT_ROOT


def _normalize_cors_origin(o: str) -> str:
    s = o.strip().strip('"').strip("'")
    if len(s) > 1 and s.endswith("/"):
        s = s.rstrip("/")
    return s


def cors_origins_list() -> list[str]:
    raw = get_settings().cors_origins
    out: list[str] = []
    for part in raw.split(","):
        n = _normalize_cors_origin(part)
        if n:
            out.append(n)
    return out
